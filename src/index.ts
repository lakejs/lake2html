type KeyValue = Record<string, string>;

type TagHandler = (boxValue: KeyValue) => string;

const config: Record<string, TagHandler> = {
  hr: () => '<div class="lake-box-block lake-hr"><hr /></div>',
  image: boxValue => {
    const attrs = {
      src: boxValue.url,
      ...(boxValue.width && { width: boxValue.width }),
      ...(boxValue.height && { height: boxValue.height }),
      ...(boxValue.caption && { alt: boxValue.caption }),
      border: '0',
    };
    return `<img ${stringifyAttributes(attrs)} />`;
  },
  file: boxValue => {
    return `<a href="${escapeSpecialChars(boxValue.url)}" target="_blank">${escapeSpecialChars(boxValue.name)}</a>`;
  },
  codeBlock: boxValue => {
    return `<pre class="lang-${escapeSpecialChars(boxValue.lang)}"><code>${escapeSpecialChars(boxValue.code)}</code></pre>`;
  },
  emoji: boxValue => {
    const attrs = {
      src: boxValue.url,
      width: '32',
      height: '32',
      border: '0',
    };
    return `<img ${stringifyAttributes(attrs)} />`;
  },
  equation: boxValue => {
    return `<code>${escapeSpecialChars(boxValue.code)}</code>`;
  },
  video: boxValue => {
    const attrs = {
      ...(boxValue.url && { src: `https://www.youtube.com/embed/${getId(boxValue.url)}` }),
      title: 'YouTube video player',
      frameborder: '0',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allowfullscreen: 'true',
      style: 'width: 560px; height: 315px;',
    };
    return `<iframe ${stringifyAttributes(attrs)}></iframe>`;
  },
  twitter: boxValue => {
    const attrs = {
      ...(boxValue.url && { src: `https://platform.twitter.com/embed/Tweet.html?id=${getId(boxValue.url)}` }),
      title: 'Twitter tweet',
      scrolling: 'no',
      frameborder: '0',
      allowtransparency: 'true',
      allowfullscreen: 'true',
      style: 'width: 550px; height: 300px;',
    };
    return `<iframe ${stringifyAttributes(attrs)}></iframe>`;
  },
};

const characterMap = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ['\xA0', '&nbsp;'],
]);

/**
 * Converts all of the reserved characters in the specified string to HTML entities.
 */
function escapeSpecialChars(value: string): string {
  return value.replace(/[&<>"\xA0]/g, match => characterMap.get(match) ?? '');
}

/**
 * Decodes a string of data which has been encoded using Base64 encoding.
 */
function fromBase64(value: string): string {
  const binaryString = atob(value);
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(byteArray);
}

/**
 * Extracts ID from the specified URL.
 */
function getId(url: string): string {
  const result = /[\w\-]+$/.exec(url || '');
  return result ? result[0] : '';
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
    result += `${key}="${escapeSpecialChars(value)}" `;
  }
  return result.trim();
}

/**
 * Converts LML string to HTML string.
 */
export function toHTML(value: string): string {
  const combinedRegex = /(<lake-box[^>]+>)[\s\S]*?(?:<\/lake-box>|$)|(<anchor\s*\/>)|(<focus\s*\/>)/gi;
  return value.replace(combinedRegex, (match, boxOpen) => {
    if (boxOpen) {
      const attributes = getAttributes(boxOpen);
      const handler = config[attributes.name];
      if (handler) {
        try {
          const decodedValue = attributes.value ? JSON.parse(fromBase64(attributes.value)) : {};
          return handler(decodedValue);
        } catch (e) {
          console.error('Failed to parse lake-box value:', e);
        }
      }
    }
    return '';
  });
}
