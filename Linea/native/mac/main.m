#import <Cocoa/Cocoa.h>
#import <OSAKit/OSAKit.h>
#import <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>

static BOOL debugLogging;
#ifdef LINEA_TESTING
static BOOL testHang;
static BOOL testRealSend;
static BOOL testReplyError;
static OSStatus testStatus = errAEEventNotPermitted;
#endif
static void diagnostic(NSString *message) {
    fprintf(stderr, "linea-media: %s\n", message.UTF8String);
    fflush(stderr);
}
static void trace(NSString *message) { if (debugLogging) diagnostic(message); }


#ifdef LINEA_TESTING
@interface ProbeReceiver : NSObject
- (void)receive:(NSAppleEventDescriptor *)event reply:(NSAppleEventDescriptor *)reply;
@end
@implementation ProbeReceiver
- (void)receive:(NSAppleEventDescriptor *)event reply:(NSAppleEventDescriptor *)reply {
    NSCAssert(NSThread.isMainThread, @"Apple event handler must use the main loop");
    NSAppleEventDescriptor *object = [event paramDescriptorForKeyword:keyDirectObject];
    NSCAssert([object descriptorForKeyword:keyAEKeyData].typeCodeValue == pName, @"Expected get name");
    trace(@"real Apple event received on main loop");
    if (testReplyError) [reply setParamDescriptor:[NSAppleEventDescriptor descriptorWithInt32:errAEEventNotPermitted] forKeyword:keyErrorNumber];
    else [reply setParamDescriptor:[NSAppleEventDescriptor descriptorWithString:@"Fixture"] forKeyword:keyDirectObject];
}
@end
#endif

static void emit(NSDictionary *value) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    fwrite(data.bytes, 1, data.length, stdout);
    fputc('\n', stdout);
    fflush(stdout);
}
static NSDictionary *failure(NSString *reason) { return @{@"ok":@NO, @"reason":reason}; }
static NSArray *targets(void) {
    // Only discovery touches AppKit. The worker never blocks the main event loop.
#ifdef LINEA_TESTING
    return @[@{@"bundle":@"com.spotify.client", @"id":@"test", @"pid":@(getpid()), @"current":@YES}];
#endif
    __block NSArray *discovered;
    dispatch_sync(dispatch_get_main_queue(), ^{
        NSMutableArray *result = [NSMutableArray array];
        pid_t front = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
        for (NSString *bundle in @[@"com.spotify.client", @"com.apple.Music"]) {
            for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:bundle]) {
                [result addObject:@{@"bundle":bundle, @"id":[NSString stringWithFormat:@"%@:%d",bundle,app.processIdentifier],
                    @"pid":@(app.processIdentifier), @"current":@(front == app.processIdentifier)}];
            }
        }
        discovered = [result copy];
    });
    return discovered;
}
static BOOL needsPermission(OSStatus status) {
    return status == errAEEventNotPermitted || status == errAEEventWouldRequireUserConsent;
}
static NSString *permissionFailure(OSStatus status) {
    if (needsPermission(status)) return @"permission_required";
    if (status == errAETimeout) return @"timeout";
    if (status == procNotFound || status == connectionInvalid) return @"session_unavailable";
    return @"source_unavailable";
}
static OSStatus permission(NSDictionary *player, BOOL prompt) {
    NSCAssert(!NSThread.isMainThread, @"Automation permission must run off the main thread");
    NSString *bundle = player[@"bundle"];
    trace([NSString stringWithFormat:@"permission probe begin target=%@ prompt=%d", bundle, prompt]);
    // A harmless get-name event exercises the actual permission path without the
    // unbounded AEDeterminePermissionToAutomateTarget preflight. Address the running
    // instance by PID so a probe cannot launch or switch to a replacement player.
    NSAppleEventDescriptor *target = [NSAppleEventDescriptor descriptorWithProcessIdentifier:[player[@"pid"] intValue]];
    NSAppleEventDescriptor *property = [NSAppleEventDescriptor recordDescriptor];
    [property setDescriptor:[NSAppleEventDescriptor descriptorWithTypeCode:typeProperty] forKeyword:keyAEDesiredClass];
    [property setDescriptor:[NSAppleEventDescriptor descriptorWithEnumCode:formPropertyID] forKeyword:keyAEKeyForm];
    [property setDescriptor:[NSAppleEventDescriptor descriptorWithTypeCode:pName] forKeyword:keyAEKeyData];
    [property setDescriptor:[NSAppleEventDescriptor nullDescriptor] forKeyword:keyAEContainer];
    NSAppleEventDescriptor *event = [NSAppleEventDescriptor appleEventWithEventClass:kAECoreSuite
        eventID:kAEGetData targetDescriptor:target returnID:kAutoGenerateReturnID transactionID:kAnyTransactionID];
    [event setParamDescriptor:[property coerceToDescriptorType:typeObjectSpecifier] forKeyword:keyDirectObject];
    AESendMode mode = kAEWaitReply | kAENeverInteract;
    if (!prompt) mode |= kAEDoNotPromptForUserConsent;
    // Apple Event timeouts use 60 ticks per second. Consent only happens on a click.
    SInt32 ticks = prompt ? 50 * 60 : 60;
    AppleEvent reply = {typeNull, NULL};
    OSStatus status;
#ifdef LINEA_TESTING
    NSAppleEventDescriptor *object = [event paramDescriptorForKeyword:keyDirectObject];
    NSCAssert(object.descriptorType == typeObjectSpecifier, @"Expected a property specifier");
    NSCAssert([object descriptorForKeyword:keyAEKeyData].typeCodeValue == pName, @"Only read the app name");
    NSCAssert(((mode & kAEDoNotPromptForUserConsent) != 0) == !prompt, @"Polling must not prompt");
    NSCAssert(ticks > 0 && ticks <= 3000, @"Every send must have a deadline");
    dispatch_sync(dispatch_get_main_queue(), ^{ trace(@"permission main-loop callback"); });
    if (testHang) dispatch_semaphore_wait(dispatch_semaphore_create(0), DISPATCH_TIME_FOREVER);
    if (!testRealSend) status = testStatus;
    else
#endif
    status = AESendMessage(event.aeDesc, &reply, mode, ticks);
    if (status == noErr) {
        // Transport success does not mean the player accepted the event.
        SInt32 replyError = noErr;
        if (AEGetParamPtr(&reply, keyErrorNumber, typeSInt32, NULL, &replyError, sizeof(replyError), NULL) == noErr)
            status = replyError;
    }
    AEDisposeDesc(&reply);
    trace([NSString stringWithFormat:@"permission probe end target=%@ status=%d", bundle, (int)status]);
    return status;
}
int main(int argc, char **argv) {
    @autoreleasepool {
        debugLogging = getenv("LINEA_MEDIA_DEBUG") != NULL;
#ifdef LINEA_TESTING
        testHang = argc > 1 && strcmp(argv[1], "--test-hang") == 0;
        if (argc > 1 && strcmp(argv[1], "--test-timeout") == 0) testStatus = errAETimeout;
        if (argc > 1 && strcmp(argv[1], "--test-consent") == 0) testStatus = errAEEventWouldRequireUserConsent;
        if (argc > 1 && strcmp(argv[1], "--test-gone") == 0) testStatus = procNotFound;
        testReplyError = argc > 1 && strcmp(argv[1], "--test-reply-error") == 0;
        testRealSend = testReplyError || (argc > 1 && strcmp(argv[1], "--test-real-send") == 0);
        ProbeReceiver *receiver = [ProbeReceiver new];
        [NSAppleEventManager.sharedAppleEventManager setEventHandler:receiver andSelector:@selector(receive:reply:)
            forEventClass:kAECoreSuite andEventID:kAEGetData];
#endif
        // The parent owns the pipes; also exit if a wedged script outlives its parent.
        pid_t parent = getppid();
        dispatch_source_t watcher = dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC, parent, DISPATCH_PROC_EXIT,
            dispatch_get_global_queue(QOS_CLASS_UTILITY, 0));
        dispatch_source_set_event_handler(watcher, ^{ _exit(0); });
        dispatch_resume(watcher);
        NSString *path = [[[NSString stringWithUTF8String:argv[0]] stringByDeletingLastPathComponent]
            stringByAppendingPathComponent:@"media.js"];
        NSString *source = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
        if (!source) { diagnostic(@"missing or unreadable bundled media.js"); return 2; }
        dispatch_async(dispatch_queue_create("linea.media.requests", DISPATCH_QUEUE_SERIAL), ^{
            @autoreleasepool {
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
                        NSString *method = request[@"method"];
                        trace([NSString stringWithFormat:@"request %@ method=%@ discovery begin", request[@"id"], method]);
                        // Also bound direct diagnostic runs, where Electron cannot kill a hung helper.
                        dispatch_source_t deadline = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
                        double seconds = [method isEqual:@"authorize"] ? 55.0 : 4.5;
#ifdef LINEA_TESTING
                        seconds = 0.5;
#endif
                        dispatch_source_set_timer(deadline, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(seconds * NSEC_PER_SEC)), DISPATCH_TIME_FOREVER, 0);
                        dispatch_source_set_event_handler(deadline, ^{
                            diagnostic([NSString stringWithFormat:@"request %@ method=%@ timed out; terminating helper", request[@"id"], method]);
                            _exit(75);
                        });
                        dispatch_resume(deadline);
                        NSDictionary *answer = nil;
                        NSArray *running = targets();
                        trace([NSString stringWithFormat:@"discovery end count=%lu", (unsigned long)running.count]);
                        if (![request[@"v"] isEqual:@1]) answer = failure(@"invalid_request");
                        else if (![@[@"snapshot", @"command", @"authorize"] containsObject:method ?: @""]) answer = failure(@"invalid_request");
                        else if ([method isEqual:@"authorize"]) {
                            // One prompt per click. Reading never prompts or launches another app.
                            if (!running.count) answer = failure(@"session_unavailable");
                            for (NSUInteger i = 0; i < running.count; i++) {
                                NSUInteger index = (nextPermissionTarget + i) % running.count;
                                NSDictionary *target = running[index];
                                OSStatus existing = permission(target, NO);
                                if (needsPermission(existing)) {
                                    nextPermissionTarget = (index + 1) % running.count;
                                    OSStatus status = permission(target, YES);
                                    answer = status == noErr ? @{@"ok":@YES,@"data":NSNull.null} : failure(permissionFailure(status));
                                    break;
                                }
                                if (existing != noErr) answer = failure(permissionFailure(existing));
                            }
                            if (!answer) answer = @{@"ok":@YES,@"data":NSNull.null};
                        } else {
                            NSMutableArray *allowed = [NSMutableArray array];
                            BOOL denied = NO;
                            NSString *probeError = nil;
                            for (NSDictionary *target in running) {
                                OSStatus status = permission(target, NO);
                                if (status == noErr) [allowed addObject:target];
                                else if (needsPermission(status)) denied = YES;
                                else probeError = permissionFailure(status);
                            }
                            if ([method isEqual:@"command"]) {
                                NSDictionary *previous = known[request[@"sessionId"] ?: @""];
                                if (!previous || ![previous[@"mediaRevision"] isEqual:request[@"mediaRevision"]])
                                    answer = failure(@"session_unavailable");
                                else {
                                    NSPredicate *matches = [NSPredicate predicateWithFormat:@"id == %@",request[@"sessionId"]];
                                    allowed = [[allowed filteredArrayUsingPredicate:matches] mutableCopy];
                                    if (!allowed.count) answer = failure(probeError ?: (denied ? @"permission_required" : @"session_unavailable"));
                                }
                            }
                            if (!answer && !allowed.count && (probeError || denied)) answer = failure(probeError ?: @"permission_required");
                            if (!answer) {
                                NSMutableDictionary *input = [request mutableCopy];
                                input[@"targets"] = allowed;
                                if ([method isEqual:@"command"]) input[@"nativeKey"] = known[request[@"sessionId"]][@"nativeKey"];
                                NSData *json = [NSJSONSerialization dataWithJSONObject:input options:0 error:nil];
                                NSString *argument = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
                                NSString *program = [source stringByAppendingFormat:
                                    @"\ntry { JSON.stringify(handle(%@)) } catch(e) { JSON.stringify({ok:false,reason:Number(e.errorNumber)===-1743?'permission_required':'command_rejected'}) }",argument];
                                trace(@"playback script begin");
                                OSAScript *script = [[OSAScript alloc] initWithSource:program
                                    language:[OSALanguage languageForName:@"JavaScript"]];
                                NSDictionary *error = nil;
                                NSAppleEventDescriptor *result = [script executeAndReturnError:&error];
                                trace(@"playback script end");
                                // Log only the numeric OSA error, not script contents or track metadata.
                                if (error) diagnostic([NSString stringWithFormat:@"playback script error=%@", error[OSAScriptErrorNumber]]);
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
                        dispatch_sync(dispatch_get_main_queue(), ^{ dispatch_source_cancel(deadline); });
                        trace([NSString stringWithFormat:@"response %@ ok=%@ reason=%@", request[@"id"], answer[@"ok"], answer[@"reason"] ?: @"none"]);
                        emit(response);
                    }
                }
                free(line);
                dispatch_source_cancel(watcher);
                trace(@"stdin closed; exiting");
                exit(0);
            }
        });
        // Keep a source installed so the run loop also services AppKit and main-queue callbacks.
        NSMachPort *keepAlive = [NSMachPort port];
        [NSRunLoop.currentRunLoop addPort:keepAlive forMode:NSDefaultRunLoopMode];
        [NSRunLoop.currentRunLoop run];
    }
    return 0;
}
