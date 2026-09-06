#include <windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Media.h>
#include <winrt/Windows.Media.Control.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <vector>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>

using namespace winrt;
using namespace Windows::Foundation;
using namespace Windows::Data::Json;
using namespace Windows::Media;
using namespace Windows::Media::Control;

namespace {
std::mutex outputMutex;
std::atomic<bool> active{true};
void emit(JsonObject const& value) {
    std::lock_guard guard(outputMutex);
    std::cout << to_string(value.Stringify()) << '\n' << std::flush;
}
void put(JsonObject const& o, wchar_t const* key, bool v) { o.Insert(key, JsonValue::CreateBooleanValue(v)); }
void put(JsonObject const& o, wchar_t const* key, double v) { o.Insert(key, JsonValue::CreateNumberValue(v)); }
void put(JsonObject const& o, wchar_t const* key, hstring const& v) { o.Insert(key, JsonValue::CreateStringValue(v)); }
void put(JsonObject const& o, wchar_t const* key, wchar_t const* v) { put(o, key, hstring(v)); }
void nullValue(JsonObject const& o, wchar_t const* key) { o.Insert(key, JsonValue::CreateNullValue()); }
void invalidate() {
    if (!active) return;
    JsonObject message;
    put(message, L"v", 1.0);
    put(message, L"type", L"changed");
    emit(message);
}
double milliseconds(TimeSpan value) { return static_cast<double>(value.count()) / 10000.0; }
double unixMilliseconds(DateTime value) {
    return static_cast<double>(value.time_since_epoch().count() - 116444736000000000LL) / 10000.0;
}

struct Session {
    GlobalSystemMediaTransportControlsSession value{nullptr};
    hstring id;
    unsigned long long discoveryOrder;
    hstring lastTitle, lastArtist, lastAlbum;
    std::atomic<unsigned long long> revision{1};
    event_token media{}, playback{}, timeline{};
    explicit Session(GlobalSystemMediaTransportControlsSession const& session, unsigned long long number)
        : value(session), id(to_hstring(number)), discoveryOrder(number) {

        playback = value.PlaybackInfoChanged([](auto const&, auto const&) { invalidate(); });
        timeline = value.TimelinePropertiesChanged([](auto const&, auto const&) { invalidate(); });
    }
    ~Session() {
        try { value.MediaPropertiesChanged(media); } catch (...) {}
        try { value.PlaybackInfoChanged(playback); } catch (...) {}
        try { value.TimelinePropertiesChanged(timeline); } catch (...) {}
    }
};

struct Bridge {
    GlobalSystemMediaTransportControlsSessionManager manager{nullptr};
    std::map<void*, std::shared_ptr<Session>> sessions;
    unsigned long long nextId = 0;
    event_token sessionsEvent{}, currentEvent{};
    Bridge() {
        manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
        sessionsEvent = manager.SessionsChanged([](auto const&, auto const&) { invalidate(); });
        currentEvent = manager.CurrentSessionChanged([](auto const&, auto const&) { invalidate(); });
    }
    ~Bridge() {
        active = false;
        try { manager.SessionsChanged(sessionsEvent); } catch (...) {}
        try { manager.CurrentSessionChanged(currentEvent); } catch (...) {}
        sessions.clear();
    }
    std::vector<std::shared_ptr<Session>> discover() {
        std::set<void*> present;
        std::vector<std::shared_ptr<Session>> ordered;
        for (auto const& value : manager.GetSessions()) {
            auto identity = get_abi(value.as<winrt::Windows::Foundation::IUnknown>());
            present.insert(identity);
            auto found = sessions.find(identity);
            if (found == sessions.end()) {
                auto session = std::make_shared<Session>(value, ++nextId);
                // Event handlers retain a weak reference rather than relying on destruction timing.

                std::weak_ptr<Session> weak = session;
                session->media = value.MediaPropertiesChanged([weak](auto const&, auto const&) {
                    if (auto locked = weak.lock()) { ++locked->revision; invalidate(); }
                });
                found = sessions.emplace(identity, std::move(session)).first;
            }
            ordered.push_back(found->second);
        }
        for (auto it = sessions.begin(); it != sessions.end();) {
            if (!present.contains(it->first)) it = sessions.erase(it); else ++it;
        }
        std::sort(ordered.begin(), ordered.end(), [](auto const& a, auto const& b) {
            return a->discoveryOrder < b->discoveryOrder;
        });
        return ordered;
    }
    JsonObject snapshot() {
        JsonArray list;
        auto current = manager.GetCurrentSession();
        auto currentIdentity = current ? get_abi(current.as<winrt::Windows::Foundation::IUnknown>()) : nullptr;
        for (auto const& entry : discover()) {
            try {
            auto const& s = entry->value;
            auto revision = entry->revision.load();
            auto media = s.TryGetMediaPropertiesAsync().get();
            auto info = s.GetPlaybackInfo();
            auto timeline = s.GetTimelineProperties();
            if (revision != entry->revision.load()) { invalidate(); continue; }
            entry->lastTitle = media.Title();
            entry->lastArtist = media.Artist();
            entry->lastAlbum = media.AlbumTitle();
            JsonObject row;
            put(row, L"id", entry->id);
            put(row, L"mediaRevision", static_cast<double>(revision));
            put(row, L"appId", s.SourceAppUserModelId());
            put(row, L"current", get_abi(s.as<winrt::Windows::Foundation::IUnknown>()) == currentIdentity);
            put(row, L"title", media.Title());
            put(row, L"artist", media.Artist());
            put(row, L"album", media.AlbumTitle());
            auto type = info.PlaybackType();
            put(row, L"mediaType", type && type.Value() == MediaPlaybackType::Music ? L"music" :
                type && type.Value() == MediaPlaybackType::Video ? L"video" : L"unknown");
            auto status = info.PlaybackStatus();
            put(row, L"status", status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing ? L"playing" :
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused ? L"paused" :
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped ? L"stopped" : L"other");
            auto rate = info.PlaybackRate();
            if (rate) put(row, L"rate", rate.Value()); else nullValue(row, L"rate");
            auto shuffle = info.IsShuffleActive();
            if (shuffle) put(row, L"shuffle", shuffle.Value()); else nullValue(row, L"shuffle");
            auto repeat = info.AutoRepeatMode();
            if (repeat) put(row, L"repeat", repeat.Value() == MediaPlaybackAutoRepeatMode::Track ? L"track" :
                repeat.Value() == MediaPlaybackAutoRepeatMode::List ? L"context" : L"off");
            else nullValue(row, L"repeat");
            JsonObject controls;
            auto c = info.Controls();
            put(controls, L"play", c.IsPlayEnabled());
            put(controls, L"pause", c.IsPauseEnabled());
            put(controls, L"toggle", c.IsPlayPauseToggleEnabled());
            put(controls, L"next", c.IsNextEnabled());
            put(controls, L"previous", c.IsPreviousEnabled());
            put(controls, L"seek", c.IsPlaybackPositionEnabled());
            put(controls, L"shuffle", c.IsShuffleEnabled());
            put(controls, L"repeat", c.IsRepeatEnabled());
            row.Insert(L"controls", controls);
            JsonObject clock;
            put(clock, L"startMs", milliseconds(timeline.StartTime()));
            put(clock, L"endMs", milliseconds(timeline.EndTime()));
            put(clock, L"positionMs", milliseconds(timeline.Position()));
            put(clock, L"updatedAt", unixMilliseconds(timeline.LastUpdatedTime()));
            put(clock, L"minSeekMs", milliseconds(timeline.MinSeekTime()));
            put(clock, L"maxSeekMs", milliseconds(timeline.MaxSeekTime()));
            row.Insert(L"timeline", clock);
            list.Append(row);
            } catch (hresult_error const&) {
                // A closing or inaccessible session must not hide other working players.
            }
        }
        JsonObject result;
        result.Insert(L"sessions", list);
        return result;
    }
    hstring command(JsonObject const& request) {
        auto id = request.GetNamedString(L"sessionId");
        auto revision = request.GetNamedNumber(L"mediaRevision");
        std::shared_ptr<Session> entry;
        for (auto const& candidate : discover()) if (candidate->id == id) entry = candidate;
        if (!entry || static_cast<double>(entry->revision.load()) != revision) return L"session_unavailable";
        auto const& s = entry->value;
        auto media = s.TryGetMediaPropertiesAsync().get();
        if (static_cast<double>(entry->revision.load()) != revision || media.Title() != entry->lastTitle ||
            media.Artist() != entry->lastArtist || media.AlbumTitle() != entry->lastAlbum) return L"session_unavailable";
        auto info = s.GetPlaybackInfo();
        auto c = info.Controls();
        auto type = request.GetNamedString(L"command");
        bool ok = false;
        if (type == L"play" || type == L"pause") {
            bool play = type == L"play";
            bool playing = info.PlaybackStatus() == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
            if (play == playing) return L"";
            if (play && c.IsPlayEnabled()) ok = s.TryPlayAsync().get();
            else if (!play && c.IsPauseEnabled()) ok = s.TryPauseAsync().get();
            else if (c.IsPlayPauseToggleEnabled()) ok = s.TryTogglePlayPauseAsync().get();
            else return L"unsupported_command";
        } else if (type == L"next") {
            if (!c.IsNextEnabled()) return L"unsupported_command";
            ok = s.TrySkipNextAsync().get();
        } else if (type == L"previous") {
            if (!c.IsPreviousEnabled()) return L"unsupported_command";
            ok = s.TrySkipPreviousAsync().get();
        } else if (type == L"seek") {
            if (!c.IsPlaybackPositionEnabled()) return L"unsupported_command";
            auto t = s.GetTimelineProperties();
            double position = request.GetNamedNumber(L"positionMs");
            double absolute = position + milliseconds(t.StartTime());
            if (!std::isfinite(position) || position < 0 || absolute < milliseconds(t.MinSeekTime()) ||
                absolute > milliseconds(t.MaxSeekTime()) || t.MaxSeekTime() <= t.MinSeekTime()) return L"invalid_request";
            ok = s.TryChangePlaybackPositionAsync(static_cast<int64_t>(std::llround(absolute * 10000))).get();
        } else if (type == L"shuffle") {
            if (!c.IsShuffleEnabled() || !info.IsShuffleActive()) return L"unsupported_command";
            ok = s.TryChangeShuffleActiveAsync(request.GetNamedBoolean(L"state")).get();
        } else if (type == L"repeat") {
            if (!c.IsRepeatEnabled() || !info.AutoRepeatMode()) return L"unsupported_command";
            auto mode = request.GetNamedString(L"mode");
            if (mode != L"off" && mode != L"context" && mode != L"track") return L"invalid_request";
            ok = s.TryChangeAutoRepeatModeAsync(mode == L"track" ? MediaPlaybackAutoRepeatMode::Track :
                mode == L"context" ? MediaPlaybackAutoRepeatMode::List : MediaPlaybackAutoRepeatMode::None).get();
        } else return L"invalid_request";
        invalidate();
        return ok ? L"" : L"command_rejected";
    }
};
}

int main(int argc, char** argv) {
    init_apartment(apartment_type::multi_threaded);
    if (argc == 3 && std::string(argv[1]) == "--parent") {
        DWORD pid = static_cast<DWORD>(std::stoul(argv[2]));
        HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, pid);
        if (!parent) return 2;
        std::thread([parent] { WaitForSingleObject(parent, INFINITE); CloseHandle(parent); ExitProcess(0); }).detach();
    }
    try {
        Bridge bridge;
        JsonObject ready;
        put(ready, L"v", 1.0); put(ready, L"type", L"ready"); emit(ready);
        if (argc == 2 && std::string(argv[1]) == "--probe") {
            auto value = bridge.snapshot();
            put(value, L"v", 1.0); put(value, L"type", L"snapshot"); emit(value);
            return 0;
        }
        std::string line;
        while (std::getline(std::cin, line)) {
            if (line.size() > 65536) return 2;
            JsonObject response;
            put(response, L"v", 1.0);
            put(response, L"type", L"response");
            try {
                auto request = JsonObject::Parse(to_hstring(line));
                response.Insert(L"id", request.GetNamedValue(L"id"));
                if (request.GetNamedNumber(L"v") != 1) throw hresult_invalid_argument();
                auto method = request.GetNamedString(L"method");
                if (method == L"snapshot") {
                    response.Insert(L"data", bridge.snapshot()); put(response, L"ok", true);
                } else if (method == L"command") {
                    auto reason = bridge.command(request);
                    put(response, L"ok", reason.empty());
                    if (!reason.empty()) put(response, L"reason", reason);
                    else nullValue(response, L"data");
                } else { put(response, L"ok", false); put(response, L"reason", L"invalid_request"); }
            } catch (hresult_error const& error) {
                std::cerr << "Request failed: " << to_string(error.message()) << '\n';
                put(response, L"ok", false); put(response, L"reason", L"source_unavailable");
            }
            emit(response);
        }
    } catch (hresult_error const& error) {
        std::cerr << "Windows media sessions unavailable: " << to_string(error.message()) << '\n';
        return 1;
    } catch (std::exception const& error) {
        std::cerr << error.what() << '\n'; return 1;
    }
    return 0;
}

