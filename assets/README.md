# assets

Drop the real ads in here — screenshots, exports, stills pulled from video.

Then point a creative at one by adding an `img` field in `creative-library.html`:

```js
{id:"m-101", client:"Kiss Now", … , img:"assets/kissnow-lip-oil.jpg"}
```

Anything with an `img` renders the real file. Anything without falls back to a colour
block, so a half-finished import still looks like a board.

Keep files under ~500 KB each (they're served as-is, no image pipeline). Portrait ads
work best at 1080×1920, feed ads at 1080×1350.
