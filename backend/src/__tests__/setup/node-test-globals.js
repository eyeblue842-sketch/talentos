function installDomMatrixPolyfill() {
  if (globalThis.DOMMatrix) return;

  class DOMMatrixPolyfill {
    constructor(init = undefined) {
      this.is2D = true;
      this.isIdentity = true;
      this.m11 = 1;
      this.m12 = 0;
      this.m13 = 0;
      this.m14 = 0;
      this.m21 = 0;
      this.m22 = 1;
      this.m23 = 0;
      this.m24 = 0;
      this.m31 = 0;
      this.m32 = 0;
      this.m33 = 1;
      this.m34 = 0;
      this.m41 = 0;
      this.m42 = 0;
      this.m43 = 0;
      this.m44 = 1;

      if (Array.isArray(init) && init.length >= 6) {
        [this.m11, this.m12, this.m21, this.m22, this.m41, this.m42] = init;
        this.isIdentity = false;
      }
    }

    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    translateSelf(x = 0, y = 0) {
      this.m41 += Number(x) || 0;
      this.m42 += Number(y) || 0;
      this.isIdentity = false;
      return this;
    }
    scaleSelf() {
      this.isIdentity = false;
      return this;
    }
    rotateSelf() {
      this.isIdentity = false;
      return this;
    }
    invertSelf() { return this; }
    transformPoint(point = {}) {
      return {
        x: point.x ?? 0,
        y: point.y ?? 0,
        z: point.z ?? 0,
        w: point.w ?? 1,
      };
    }
    toFloat32Array() {
      return new Float32Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44,
      ]);
    }
  }

  globalThis.DOMMatrix = DOMMatrixPolyfill;
}

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageDataPolyfill {
    constructor(data = [], width = 0, height = 0) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2DPolyfill {};
}

installDomMatrixPolyfill();
