import { MAX_SOURCE_BYTES, PHOTO_SIZE, resizeToSquareDataUrl } from "./repImage";

const file = (type, size = 10) => ({ type, size });

describe("resizeToSquareDataUrl — refusing bad input", () => {
  it("refuses anything that isn't a picture, and SVG (it can carry script)", async () => {
    await expect(resizeToSquareDataUrl(null)).rejects.toThrow(/Choose a photo/);
    await expect(resizeToSquareDataUrl(file("application/pdf"))).rejects.toThrow(/Choose a photo/);
    await expect(resizeToSquareDataUrl(file("image/svg+xml"))).rejects.toThrow(/Choose a photo/);
  });

  it("refuses a picture over 10 MB before trying to decode it", async () => {
    await expect(resizeToSquareDataUrl(file("image/jpeg", MAX_SOURCE_BYTES + 1))).rejects.toThrow(/too big/);
  });
});

describe("resizeToSquareDataUrl — cropping", () => {
  const realCreate = global.createImageBitmap;
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  const realToDataURL = HTMLCanvasElement.prototype.toDataURL;
  let draw;

  beforeEach(() => {
    draw = jest.fn();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ fillRect: jest.fn(), drawImage: draw, set fillStyle(_v) {} }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn((type, q) => `data:${type};q=${q};base64,FAKE`);
  });
  afterEach(() => {
    global.createImageBitmap = realCreate;
    HTMLCanvasElement.prototype.getContext = realGetContext;
    HTMLCanvasElement.prototype.toDataURL = realToDataURL;
  });

  it("centre-crops a landscape picture to a square and scales it to 256×256 JPEG", async () => {
    global.createImageBitmap = jest.fn(async () => ({ width: 400, height: 200, close: jest.fn() }));

    const out = await resizeToSquareDataUrl(file("image/png"));

    expect(out).toMatch(/^data:image\/jpeg;/);
    expect(global.createImageBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: "from-image" });
    // 400×200 → a 200×200 square taken from x=100 (the middle), drawn into 256×256
    expect(draw).toHaveBeenCalledWith(expect.anything(), 100, 0, 200, 200, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  });

  it("centre-crops a portrait picture from the middle vertically", async () => {
    global.createImageBitmap = jest.fn(async () => ({ width: 300, height: 900, close: jest.fn() }));

    await resizeToSquareDataUrl(file("image/jpeg"));

    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 300, 300, 300, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  });

  it("releases the decoded bitmap", async () => {
    const close = jest.fn();
    global.createImageBitmap = jest.fn(async () => ({ width: 100, height: 100, close }));
    await resizeToSquareDataUrl(file("image/webp"));
    expect(close).toHaveBeenCalled();
  });
});
