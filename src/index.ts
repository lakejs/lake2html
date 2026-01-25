// Define a generic type for HTML attributes (key-value pairs)
type AttributeMap = Record<string, string>;

// Structure representing the output HTML node
interface BoxHTMLNode {
  tagName: string;
  attributes?: AttributeMap;
  isVoid?: boolean; // True for self-closing tags like <img />, <hr />
  innerHTML?: string;
}

// Function signature for encoding HTML entities
type EncodeHTMLEntities = (value: string) => string;

// Function signature for encoding HTML entities
type RenderBox = (boxValue: AttributeMap, encode: EncodeHTMLEntities) => BoxHTMLNode;

// Registry of renderers for different box types
type BoxRenderers = Record<string, RenderBox>;

/**
 * Extracts the ID from a URL.
 * Useful for extracting YouTube or Twitter IDs from clean URLs.
 */
function extractIdFromUrl(url: string): string {
  const result = /[\w\-]+$/.exec(url);
  return result ? result[0] : '';
}

/**
 * Returns the default configuration for rendering various Lake attributes.
 */
export function getBoxRenderers(): BoxRenderers {
  return {
    hr: () => ({
      tagName: 'div',
      attributes: {
        class: 'lake-box-block lake-hr',
      },
      innerHTML: '<hr />',
    }),

    image: boxValue => ({
      tagName: 'img',
      attributes: {
        src: boxValue.url,
        ...(boxValue.width && { width: boxValue.width }),
        ...(boxValue.height && { height: boxValue.height }),
        ...(boxValue.caption && { alt: boxValue.caption }),
        border: '0',
      },
      isVoid: true,
    }),

    file: (boxValue, encode) => ({
      tagName: 'a',
      attributes: {
        href: boxValue.url,
        target: '_blank',
      },
      innerHTML: encode(boxValue.name),
    }),

    codeBlock: (boxValue, encode) => ({
      tagName: 'pre',
      attributes: {
        class: `lang-${boxValue.lang}`,
      },
      innerHTML: `<code>${encode(boxValue.code)}</code>`,
    }),

    emoji: boxValue => ({
      tagName: 'img',
      attributes: {
        src: boxValue.url,
        width: '32',
        height: '32',
        border: '0',
      },
      isVoid: true,
    }),

    equation: boxValue => ({
      tagName: 'code',
      innerHTML: boxValue.code,
    }),

    mention: (boxValue, encode) => ({
      tagName: 'a',
      attributes: {
        href: `/${boxValue.name}`,
        target: '_blank',
      },
      innerHTML: encode(boxValue.nickname ?? boxValue.name),
    }),

    video: boxValue => ({
      tagName: 'iframe',
      attributes: {
        ...(boxValue.url && { src: `https://www.youtube.com/embed/${extractIdFromUrl(boxValue.url)}` }),
        title: 'YouTube video player',
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        referrerpolicy: 'strict-origin-when-cross-origin',
        allowfullscreen: 'true',
        style: 'width: 560px; height: 315px;',
      },
    }),

    twitter: boxValue => ({
      tagName: 'iframe',
      attributes: {
        ...(boxValue.url && { src: `https://platform.twitter.com/embed/Tweet.html?id=${extractIdFromUrl(boxValue.url)}` }),
        title: 'Twitter tweet',
        scrolling: 'no',
        frameborder: '0',
        allowtransparency: 'true',
        allowfullscreen: 'true',
        style: 'width: 550px; height: 300px;',
      },
    }),
  };
}

// Map for reserved HTML characters
const htmlEntityMap = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ['\xA0', '&nbsp;'],
]);

/**
 * Escapes reserved HTML characters to prevent XSS and rendering issues.
 */
function encodeHTMLEntities(value: string): string {
  return value.replace(/[&<>"\xA0]/g, match => htmlEntityMap.get(match)!);
}

/**
 * Decodes a Base64 encoded string with UTF-8 support.
 */
function decodeBase64(value: string): string {
  const binaryString = atob(value);
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(byteArray);
}

/**
 * Parses HTML tag attributes from a string into a key-value object.
 */
function parseAttributes(tag: string): AttributeMap {
  const attributes: AttributeMap = {};
  // Regex breakdown:
  // Group 1/2: Key=Value (unquoted)
  // Group 3/4: Key="Value" (double quoted)
  // Group 5/6: Key='Value' (single quoted)
  const reg = /\s+(?:([\w\-:]+)=([^\s"'<>]+)|([\w\-:"]+)="([^"]*)"|([\w\-:"]+)='([^']*)')(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = reg.exec(tag))) {
    const key = (match[1] || match[3] || match[5]).toLowerCase();
    const value = match[1] ? match[2] : (match[3] ? match[4] : match[6]);
    attributes[key] = value;
  }
  return attributes;
}

/**
 * Serializes an attribute map into an HTML attribute string.
 */
function serializeAttributes(attrs: AttributeMap): string {
  const result: string[] = [];
  for (const key of Object.keys(attrs)) {
    const value = String(attrs[key]);
    result.push(`${key}="${encodeHTMLEntities(value)}"`);
  }
  return result.join(' ');
}

/**
 * Serializes a BoxHTMLNode object into a standard HTML string.
 */
function toBoxHTML(node: BoxHTMLNode): string {
  let result = `<${node.tagName}`;
  if (node.attributes) {
    result += ` ${serializeAttributes(node.attributes)}`;
  }
  if (node.isVoid === true) {
    result += ' />';
  } else {
    result += `>${node.innerHTML ?? ''}</${node.tagName}>`;
  }
  return result;
}

/**
 * Main function to convert Lake Markup Language (LML) to standard HTML.
 * It processes custom <lake-box> tags and removes internal anchors.
 */
export function toHTML(value: string, renderers?: BoxRenderers): string {
  renderers = renderers ?? getBoxRenderers();
  // Regex to match <lake-box>, <anchor>, and <focus> tags
  const combinedRegex = /(<lake-box[^>]+>)[\s\S]*?(?:<\/lake-box>|$)|(<anchor\s*\/>)|(<focus\s*\/>)/gi;
  return value.replace(combinedRegex, (match, boxOpen) => {
    // Handle lake-box conversion
    if (boxOpen) {
      const attributes = parseAttributes(boxOpen);
      const render = renderers[attributes.name];
      if (render) {
        try {
          const boxValue = attributes.value ? JSON.parse(decodeBase64(attributes.value)) : {};
          const node = render(boxValue, encodeHTMLEntities);
          return toBoxHTML(node);
        } catch (e) {
          console.error('Failed to parse lake-box value:', e);
        }
      }
    }
    // Remove internal selection markers (<anchor /> and <focus />)
    return '';
  });
}
