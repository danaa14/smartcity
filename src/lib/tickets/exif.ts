/** Reads GPS coordinates from JPEG EXIF without sending the image to a third party. */
export function gpsFromExif(buffer: ArrayBuffer): { lat: number; lng: number } | null {
  const v = new DataView(buffer);
  const u16 = (p: number, le: boolean) => v.getUint16(p, le);
  const u32 = (p: number, le: boolean) => v.getUint32(p, le);
  if (v.byteLength < 12 || u16(0, false) !== 0xffd8) return null;
  let p = 2;
  while (p + 4 < v.byteLength) {
    if (u16(p, false) !== 0xffe1) { p += 1; continue; }
    const size = u16(p + 2, false);
    if (p + size + 2 > v.byteLength) return null;
    if (v.getUint32(p + 4, false) !== 0x45786966 || u16(p + 8, false) !== 0) { p += size + 2; continue; }
    const t = p + 10;
    const le = v.getUint16(t, false) === 0x4949;
    if (u16(t + 2, le) !== 42) return null;
    const ifd = t + u32(t + 4, le);
    if (ifd + 2 >= v.byteLength) return null;
    let gps = -1;
    for (let i = 0; i < u16(ifd, le); i++) { const e = ifd + 2 + i * 12; if (u16(e, le) === 0x8825) gps = t + u32(e + 8, le); }
    if (gps < 0 || gps + 2 >= v.byteLength) return null;
    let latRef = "N", lngRef = "E", latData = -1, lngData = -1;
    for (let i = 0; i < u16(gps, le); i++) {
      const e = gps + 2 + i * 12, tag = u16(e, le), type = u16(e + 2, le), count = u32(e + 4, le);
      if (tag === 1 && type === 2) latRef = String.fromCharCode(v.getUint8(e + 8));
      if (tag === 3 && type === 2) lngRef = String.fromCharCode(v.getUint8(e + 8));
      if (tag === 2 && type === 5 && count >= 3) latData = t + u32(e + 8, le);
      if (tag === 4 && type === 5 && count >= 3) lngData = t + u32(e + 8, le);
    }
    const dms = (at: number) => { const a = u32(at, le) / u32(at + 4, le), b = u32(at + 8, le) / u32(at + 12, le), c = u32(at + 16, le) / u32(at + 20, le); return a + b / 60 + c / 3600; };
    if (latData < 0 || lngData < 0 || latData + 24 > v.byteLength || lngData + 24 > v.byteLength) return null;
    const lat = dms(latData) * (latRef === "S" ? -1 : 1), lng = dms(lngData) * (lngRef === "W" ? -1 : 1);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }
  return null;
}
