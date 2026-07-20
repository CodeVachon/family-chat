# Vendored Emojibase data

`en/data.json` and `en/messages.json` are copied verbatim from the
[`emojibase-data`](https://www.npmjs.com/package/emojibase-data) package
(v15.3.2, `en` locale).

The emoji picker (`frimousse`) fetches these at runtime. By default frimousse
loads them from `cdn.jsdelivr.net`, but the app's strict `connect-src` CSP (see
`apps/web/proxy.ts`) only allows `'self'`, so we serve them locally and set
`emojibaseUrl="/emojibase-data"` in `components/channels/emoji-picker.tsx`.

To refresh: copy `en/data.json` and `en/messages.json` from a newer
`emojibase-data` release into `en/`.
