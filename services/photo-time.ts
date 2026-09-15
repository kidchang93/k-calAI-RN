import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

// 앨범에서 고른 사진의 **촬영 시각**을 읽는다 (KCAL-20). 끼니 자동 지정의 기준이 화면을 연
// 시각이면, 어제 저녁 사진을 오늘 아침에 올릴 때 '아침'이 채워진다 — 틀린 자동값은 사용자가
// 이미 맞춰졌다고 믿고 지나치므로 없는 것보다 나쁘다.
//
// - 네이티브: expo-image-picker 의 `exif` 옵션이 준 태그를 읽는다.
// - 웹: 피커가 EXIF 를 주지 않는다(`ExponentImagePicker.web.js` 의 TODO). 대신 넘겨주는 원본
//   File 의 JPEG 머리에서 직접 읽는다. HEIC·PNG 이거나 브라우저가 메타데이터를 지웠으면 null.
//
// 읽지 못하면 null 이고, 호출부는 지금 동작(현재 시각)으로 돌아간다.

// EXIF APP1 은 최대 64KB 라 앞부분만 읽으면 된다.
const EXIF_SCAN_BYTES = 128 * 1024;
// 기기 시계가 틀린 사진은 미래 시각을 달고 온다 — 그 값으로 끼니를 정하지 않는다.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;

export async function readPhotoTakenAt(asset: ImagePickerAsset): Promise<Date | null> {
  const raw = Platform.OS === 'web' ? await readWebExifDateTime(asset) : readNativeExifDateTime(asset);

  return raw === null ? null : parseExifDateTime(raw);
}

// "YYYY:MM:DD HH:MM:SS" — EXIF 는 시간대 없이 **촬영 기기의 현지 시각**을 적는다.
export function parseExifDateTime(value: string): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (Number.isNaN(date.getTime()) || year < 2000) {
    return null;
  }

  return date.getTime() > Date.now() + FUTURE_TOLERANCE_MS ? null : date;
}

function readNativeExifDateTime(asset: ImagePickerAsset): string | null {
  const exif = asset.exif;

  if (!exif) {
    return null;
  }

  // iOS 는 태그를 `{Exif}` 사전 아래에 두기도 한다.
  const nested = typeof exif['{Exif}'] === 'object' && exif['{Exif}'] !== null ? exif['{Exif}'] : {};

  for (const candidate of [
    exif.DateTimeOriginal,
    nested.DateTimeOriginal,
    exif.DateTimeDigitized,
    nested.DateTimeDigitized,
    exif.DateTime,
  ]) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return null;
}

async function readWebExifDateTime(asset: ImagePickerAsset): Promise<string | null> {
  try {
    const blob: Blob = asset.file !== undefined ? asset.file : await (await fetch(asset.uri)).blob();

    return findJpegDateTime(await blob.slice(0, EXIF_SCAN_BYTES).arrayBuffer());
  } catch {
    return null;
  }
}

function findJpegDateTime(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);

    // 마커가 깨졌거나 이미지 데이터(SOS)에 닿았으면 메타데이터가 더는 없다.
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda || size < 2) {
      return null;
    }

    // APP1 + "Exif\0\0"
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return readTiffDateTime(view, offset + 10, Math.min(view.byteLength, offset + 2 + size));
    }

    offset += 2 + size;
  }

  return null;
}

function readTiffDateTime(view: DataView, tiffStart: number, end: number): string | null {
  if (tiffStart + 8 > end) {
    return null;
  }

  const littleEndian = view.getUint16(tiffStart) === 0x4949;
  const ifd0 = readIfd(view, tiffStart, tiffStart + view.getUint32(tiffStart + 4, littleEndian), end, littleEndian);
  const exifOffset = ifd0.get(TAG_EXIF_IFD);
  const exifIfd =
    typeof exifOffset === 'number'
      ? readIfd(view, tiffStart, tiffStart + exifOffset, end, littleEndian)
      : new Map<number, string | number>();

  for (const value of [
    exifIfd.get(TAG_DATE_TIME_ORIGINAL),
    exifIfd.get(TAG_DATE_TIME_DIGITIZED),
    ifd0.get(TAG_DATE_TIME),
  ]) {
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

// IFD 한 개에서 우리가 쓰는 태그만 꺼낸다 — ASCII(2)는 문자열, LONG(4)은 숫자(하위 IFD 오프셋).
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  end: number,
  littleEndian: boolean
): Map<number, string | number> {
  const values = new Map<number, string | number>();

  if (ifdStart + 2 > end) {
    return values;
  }

  const count = view.getUint16(ifdStart, littleEndian);

  for (let index = 0; index < count; index += 1) {
    const entry = ifdStart + 2 + index * 12;

    if (entry + 12 > end) {
      break;
    }

    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const length = view.getUint32(entry + 4, littleEndian);

    if (tag === TAG_EXIF_IFD && type === 4) {
      values.set(tag, view.getUint32(entry + 8, littleEndian));
    } else if (
      (tag === TAG_DATE_TIME || tag === TAG_DATE_TIME_ORIGINAL || tag === TAG_DATE_TIME_DIGITIZED) &&
      type === 2 &&
      length > 4
    ) {
      const start = tiffStart + view.getUint32(entry + 8, littleEndian);

      if (start + length <= end) {
        // 마지막 1바이트는 ASCII 문자열 끝의 NUL 이라 뺀다.
        values.set(
          tag,
          new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + start, length - 1))
        );
      }
    }
  }

  return values;
}
