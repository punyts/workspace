# Bytes by statenet path: the `/paths` route

Status: designed 2026-11-22. The route is built on the tower (the owner's other machine, where statenet networking is
built), not in this workspace. The clients are built here: `map` takes a `tiles` template that is a path of the app's
own origin, `mediaPlayer` takes a `src` of the app's own origin, and uploads accept audio and video
([stateui-component-gaps.md](stateui-component-gaps.md), C7).

Asked on 2026-11-22, about where a map's tiles come from: "Is there a way we can use the same statenet path pattern?"
The owner then chose "Design here, route on tower", a tile provider that is "Configurable, decide later", and for
uploads "Audio and short video, 10 MiB".

## The design

Bytes that browsers cache (map tiles, uploaded files, recorded media) have statenet paths like any state, and are read
over HTTP on our own origin at `/paths/<the path, its segments joined by slashes>`. The state transport never carries
them ([statenet-direction.md](statenet-direction.md), "Not on this transport").

| Bytes | Statenet path | URL |
|-------|---------------|-----|
| A map tile | `[business].data.maps.<map>.tiles.<z>.<x>.<y>` | `/paths/<business>/data/maps/<map>/tiles/<z>/<x>/<y>` |
| An uploaded file | `[owner].[persona].files.<id>` | `/paths/<owner>/<persona>/files/<id>` |

A document names the URL: a `map`'s `tiles` is `/paths/<business>/data/maps/city/tiles/{z}/{x}/{y}`, and a
`mediaPlayer`'s `src` is a file's path. The browser contacts only our origin.

### Path patterns pick the source and the permission

The route uses the same matcher as the four path-pattern tables of the direction (permissions, versioning, relays,
logic), with one more table: **sources**, from a path pattern to where the bytes come from.

| Pattern | Source |
|---------|--------|
| `*.data.maps.*.tiles.*.*.*` | The tile provider: our server fetches the tile and caches it |
| `*.*.files.*` | The file store of the owner (stateui-mcp's files folder; Magnetic's file storage) |

Read permission is the permissions table's answer for the same path. A business can make a map's tiles readable by
everyone; a persona's files are readable by those the owner grants. A path no source matches is `404`, and a path the
reader may not read is `404` too, so the route does not reveal which paths exist.

### The reader

A page of our origin sends its session cookie. The runtime frame is sandboxed with an opaque origin, so its image and
media requests carry no cookie. A view therefore gets a **read grant** with its document: a token the server signs for
the path patterns that view may read, valid for minutes and renewed with the view's session. The frame appends it to a
`/paths` URL as `?g=<grant>`. The server checks the signature, the expiry and that the path matches a granted pattern.
Paths that everyone may read need no grant. Query strings of `/paths` are not logged.

### The tile provider

The provider is MapTiler (owner, 2026-11-22), configured rather than written into code: an XYZ URL template with
`{z}`, `{x}`, `{y}` and `{key}`, and the key. MapTiler's raster tiles of 256 pixels match `map`'s tile size:

```
MAP_TILES_URL=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}
```

Another MapTiler map id (or another provider) is a change of configuration only. Locally the template and key are
`MAP_TILES_URL` and `MAP_TILES_KEY` in `.env`; hosted they are the SSM parameters `/magnetic/map-tiles-url` and
`/magnetic/map-tiles-key` (us-east-1), which the owner sets. Without them the tile source answers `404` and a map shows
its background. The provider's terms decide caching and attribution; the attribution is the map's `_attribution`
(MapTiler's and OpenStreetMap's contributors'). OpenStreetMap's public tile servers forbid proxied use and are not an
option.

The server fetches a tile once and keeps it in a disk cache with a size cap, least recently used out. Concurrent misses
for one tile share one upstream fetch. Zooms outside the provider's range and coordinates outside `0 .. 2^z - 1` are
refused before any fetch.

### Responses

- Files: the stored, sniffed type (ADR-0017), `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` for
  pictures, audio and video and `attachment` for the rest, and byte ranges (`206`) so a player can seek. A file id is
  never reused, so the answer is `Cache-Control: private, max-age=31536000, immutable`.
- Tiles: `image/png` or `image/jpeg` as the provider sends them, `Cache-Control: public, max-age=86400`.
- A versioned path (`…@2.3.0+2`) never changes and is `immutable`.

## Rules and Constraints

- Cacheable bytes go over HTTP from our own origin, never over the state transport.
- The browser contacts our origin only. A provider sees our server, never a user's address.
- The provider key is never in a document, a response, a URL the browser sees or a log line; the upstream URL is not
  logged.
- Every segment is checked before it reaches a file system path or an upstream URL: owner and persona ids, a UUID for a
  file, integers for `z`, `x` and `y`. A file name is never part of a path.
- One path pattern matcher serves sources and permissions, the same one the direction names.
- The runtime frame's policy allows `img-src` and `media-src` of the app's origin for `/paths`; nothing else of the
  network opens.

## Decisions

- Bytes are addressed by their statenet path, not by a route per kind (`/tiles`, `/files`) (owner, 2026-11-22).
- The route is built on the tower; this workspace builds its clients (owner, 2026-11-22).
- The tile provider is configuration: a URL template and a key in env or SSM (owner, 2026-11-22). The provider is
  MapTiler (owner, 2026-11-22: "Let's go with MapTiler"). That its terms allow the server's proxy and disk cache is to
  be confirmed before the route is built.
- Audio and video uploads stay under the 10 MiB file limit, so only short clips fit (owner, 2026-11-22).
- The frame reads with a short-lived signed grant in the query, because its sandboxed requests carry no cookie. To be
  confirmed when the route is built.

## As built

Nothing of the route yet. Its clients are listed in [stateui-component-gaps.md](stateui-component-gaps.md), C7.
