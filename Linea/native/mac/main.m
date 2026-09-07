#import <Cocoa/Cocoa.h>
#import <OSAKit/OSAKit.h>
#import <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <unistd.h>

static void emit(NSDictionary *value) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    fwrite(data.bytes, 1, data.length, stdout);
    fputc('\n', stdout);
    fflush(stdout);
}
static NSDictionary *failure(NSString *reason) { return @{@"ok":@NO, @"reason":reason}; }
static NSArray *targets(void) {
    NSMutableArray *result = [NSMutableArray array];
    pid_t front = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    for (NSString *bundle in @[@"com.spotify.client", @"com.apple.Music"]) {
        for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:bundle]) {
            [result addObject:@{@"bundle":bundle, @"id":[NSString stringWithFormat:@"%@:%d",bundle,app.processIdentifier],
                @"current":@(front == app.processIdentifier)}];
        }
    }
    return result;
}
static OSStatus permission(NSString *bundle, BOOL prompt) {
    NSAppleEventDescriptor *target = [NSAppleEventDescriptor descriptorWithBundleIdentifier:bundle];
    return AEDeterminePermissionToAutomateTarget(target.aeDesc, typeWildCard, typeWildCard, prompt);
}
int main(int argc, char **argv) {
    @autoreleasepool {
        // The parent owns the pipes; also exit if a wedged script outlives its parent.
        pid_t parent = getppid();
        dispatch_source_t watcher = dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC, parent, DISPATCH_PROC_EXIT,
            dispatch_get_global_queue(QOS_CLASS_UTILITY, 0));
        dispatch_source_set_event_handler(watcher, ^{ _exit(0); });
        dispatch_resume(watcher);
        NSString *path = [[[NSString stringWithUTF8String:argv[0]] stringByDeletingLastPathComponent]
            stringByAppendingPathComponent:@"media.js"];
        NSString *source = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
        if (!source) return 2;
        NSMutableDictionary *known = [NSMutableDictionary dictionary];
        unsigned long long revision = 0;
        NSUInteger nextPermissionTarget = 0;
        emit(@{@"v":@1, @"type":@"ready"});
        char *line = NULL; size_t capacity = 0; ssize_t length;
        while ((length = getline(&line, &capacity, stdin)) > 0) {
            @autoreleasepool {
                if (length > 65536) break;
                NSDictionary *request = [NSJSONSerialization JSONObjectWithData:[NSData dataWithBytes:line length:length]
                    options:0 error:nil];
                if (![request isKindOfClass:NSDictionary.class] || ![request[@"id"] isKindOfClass:NSNumber.class]) break;
                NSDictionary *answer = nil;
                NSArray *running = targets();
                NSString *method = request[@"method"];
                if (![request[@"v"] isEqual:@1]) answer = failure(@"invalid_request");
                else if (![@[@"snapshot", @"command", @"authorize"] containsObject:method ?: @""]) answer = failure(@"invalid_request");
                else if ([method isEqual:@"authorize"]) {
                    // One prompt per click. Reading never prompts or launches another app.
                    if (!running.count) answer = failure(@"session_unavailable");
                    for (NSUInteger i = 0; i < running.count; i++) {
                        NSUInteger index = (nextPermissionTarget + i) % running.count;
                        NSDictionary *target = running[index];
                        if (permission(target[@"bundle"], NO) != noErr) {
                            nextPermissionTarget = (index + 1) % running.count;
                            OSStatus status = permission(target[@"bundle"], YES);
                            answer = status == noErr ? @{@"ok":@YES,@"data":NSNull.null} : failure(@"permission_required");
                            break;
                        }
                    }
                    if (!answer) answer = @{@"ok":@YES,@"data":NSNull.null};
                } else {
                    NSMutableArray *allowed = [NSMutableArray array];
                    BOOL denied = NO;
                    for (NSDictionary *target in running) {
                        if (permission(target[@"bundle"], NO) == noErr) [allowed addObject:target];
                        else denied = YES;
                    }
                    if ([method isEqual:@"command"]) {
                        NSDictionary *previous = known[request[@"sessionId"] ?: @""];
                        if (!previous || ![previous[@"mediaRevision"] isEqual:request[@"mediaRevision"]])
                            answer = failure(@"session_unavailable");
                        else {
                            NSPredicate *matches = [NSPredicate predicateWithFormat:@"id == %@",request[@"sessionId"]];
                            allowed = [[allowed filteredArrayUsingPredicate:matches] mutableCopy];
                            if (!allowed.count) answer = failure(denied ? @"permission_required" : @"session_unavailable");
                        }
                    }
                    if (!answer && !allowed.count && denied) answer = failure(@"permission_required");
                    if (!answer) {
                        NSMutableDictionary *input = [request mutableCopy];
                        input[@"targets"] = allowed;
                        if ([method isEqual:@"command"]) input[@"nativeKey"] = known[request[@"sessionId"]][@"nativeKey"];
                        NSData *json = [NSJSONSerialization dataWithJSONObject:input options:0 error:nil];
                        NSString *argument = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
                        NSString *program = [source stringByAppendingFormat:
                            @"\ntry { JSON.stringify(handle(%@)) } catch(e) { JSON.stringify({ok:false,reason:Number(e.errorNumber)===-1743?'permission_required':'command_rejected'}) }",argument];
                        OSAScript *script = [[OSAScript alloc] initWithSource:program
                            language:[OSALanguage languageForName:@"JavaScript"]];
                        NSDictionary *error = nil;
                        NSAppleEventDescriptor *result = [script executeAndReturnError:&error];
                        NSData *resultData = [result.stringValue dataUsingEncoding:NSUTF8StringEncoding];
                        answer = resultData ? [NSJSONSerialization JSONObjectWithData:resultData
                            options:NSJSONReadingMutableContainers error:nil] : nil;
                        if (![answer isKindOfClass:NSDictionary.class]) answer = failure(@"source_unavailable");
                        if ([method isEqual:@"snapshot"] && [answer[@"ok"] boolValue]) {
                            NSMutableDictionary *next = [NSMutableDictionary dictionary];
                            for (NSMutableDictionary *row in answer[@"data"][@"sessions"]) {
                                NSDictionary *old = known[row[@"id"]];
                                row[@"mediaRevision"] = [old[@"nativeKey"] isEqual:row[@"nativeKey"]]
                                    ? old[@"mediaRevision"] : @(++revision);
                                next[row[@"id"]] = [row copy];
                                [row removeObjectForKey:@"nativeKey"];
                            }
                            known = next;
                        }
                    }
                }
                NSMutableDictionary *response = [answer mutableCopy];
                response[@"v"]=@1; response[@"type"]=@"response"; response[@"id"]=request[@"id"];
                emit(response);
            }
        }
        free(line);
        dispatch_source_cancel(watcher);
    }
    return 0;
}
