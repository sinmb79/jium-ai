export type ZipTextFile = {
  name: string;
  content: string;
};

const encoder = new TextEncoder();

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const crc32Table = makeCrc32Table();

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function uint16(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return out;
}

function sanitizeZipName(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\./g, "_");
}

export function createStoredZip(files: ZipTextFile[], date = new Date()) {
  const { dosDate, dosTime } = dosDateTime(date);
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const filename = encoder.encode(sanitizeZipName(file.name));
    const content = encoder.encode(file.content);
    const checksum = crc32(content);

    const localHeader = new Uint8Array([
      ...uint32(0x04034b50),
      ...uint16(20),
      ...uint16(0x0800),
      ...uint16(0),
      ...uint16(dosTime),
      ...uint16(dosDate),
      ...uint32(checksum),
      ...uint32(content.byteLength),
      ...uint32(content.byteLength),
      ...uint16(filename.byteLength),
      ...uint16(0),
    ]);
    localChunks.push(localHeader, filename, content);

    const centralHeader = new Uint8Array([
      ...uint32(0x02014b50),
      ...uint16(20),
      ...uint16(20),
      ...uint16(0x0800),
      ...uint16(0),
      ...uint16(dosTime),
      ...uint16(dosDate),
      ...uint32(checksum),
      ...uint32(content.byteLength),
      ...uint32(content.byteLength),
      ...uint16(filename.byteLength),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(0),
      ...uint32(offset),
    ]);
    centralChunks.push(centralHeader, filename);
    offset += localHeader.byteLength + filename.byteLength + content.byteLength;
  });

  const localBytes = concatBytes(localChunks);
  const centralBytes = concatBytes(centralChunks);
  const end = new Uint8Array([
    ...uint32(0x06054b50),
    ...uint16(0),
    ...uint16(0),
    ...uint16(files.length),
    ...uint16(files.length),
    ...uint32(centralBytes.byteLength),
    ...uint32(localBytes.byteLength),
    ...uint16(0),
  ]);

  return concatBytes([localBytes, centralBytes, end]);
}
