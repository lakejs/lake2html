type KeyValue = Record<string, string>;

type BoxValueHandler = (boxValue: KeyValue) => KeyValue;

const imageTypes: Record<string, BoxValueHandler> = {
  image: boxValue => ({
    ...(boxValue.url && { src: boxValue.url }),
    ...(boxValue.width && { width: boxValue.width }),
    ...(boxValue.height && { height: boxValue.height }),
    border: '0',
  }),
  emoji: boxValue => ({
    ...(boxValue.url && { src: boxValue.url }),
    width: '32',
    height: '32',
    border: '0',
  }),
};

const characterMap = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ['\xA0', '&nbsp;'],
]);

// Converts all of the reserved characters in the specified string to HTML entities.
function encode(value: string): string {
  return value.replace(/[&<>"\xA0]/g, match => characterMap.get(match) ?? '');
}

// Decodes a string of data which has been encoded using Base64 encoding.
function fromBase64(value: string): string {
  const binaryString = atob(value);
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(byteArray);
}

function getAttributes(tag: string): KeyValue {
  const attributes: KeyValue = {};
  const reg = /\s+(?:([\w\-:]+)=([^\s"'<>]+)|([\w\-:"]+)="([^"]*)"|([\w\-:"]+)='([^']*)')(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = reg.exec(tag))) {
    const key = (match[1] || match[3] || match[5]).toLowerCase();
    const value = (match[1] ? match[2] : (match[3] ? match[4] : match[6])) || '';
    attributes[key] = value;
  }
  return attributes;
}

function stringifyAttributes(attrs: KeyValue): string {
  let result: string = '';
  for (const key of Object.keys(attrs)) {
    const value = String(attrs[key]);
    result += `${key}="${encode(value)}" `;
  }
  return result.trim();
}

/**
 * Converts LML string to HTML string.
 */
export function toHTML(value: string): string {
  const combinedRegex = /(<lake-box[^>]+>)[\s\S]*?(?:<\/lake-box>|$)|(<anchor\s*\/>)|(<focus\s*\/>)/gi;
  return value.replace(combinedRegex, (match, boxOpen, anchorMatch, focusMatch) => {
    if (boxOpen) {
      const attributes = getAttributes(boxOpen);
      const handler = imageTypes[attributes.name];
      if (handler && attributes.value) {
        try {
          const decodedValue = JSON.parse(fromBase64(attributes.value));
          const finalAttrs = handler(decodedValue);
          return `<img ${stringifyAttributes(finalAttrs)} />`;
        } catch (e) {
          console.error('Failed to parse lake-box value:', e);
          return '';
        }
      }
      return '';
    }
    if (anchorMatch || focusMatch) {
      return '';
    }
    return match;
  });
}
