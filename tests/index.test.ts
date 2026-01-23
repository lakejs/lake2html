import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toHTML } from '../src';

// Creates a Base64-encoded ASCII string from a string.
function toBase64(value: string): string {
  const encoder = new TextEncoder();
  const byteArray = encoder.encode(value);
  let binaryString = '';
  byteArray.forEach(byte => {
    binaryString += String.fromCharCode(byte);
  });
  return btoa(binaryString);
}

// Creates a Base64-encoded ASCII string used in lake-box.
function createBoxValue(boxValue: object): string {
  return toBase64(JSON.stringify(boxValue));
};

describe('toHTML()', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should strip <anchor /> and <focus /> tags', () => {
    const input = 'Hello<anchor />world<focus />';
    const expected = 'Helloworld';
    expect(toHTML(input)).toBe(expected);
  });

  it('should return original text if no special tags are matched', () => {
    const input = '<p>Normal HTML content</p>';
    const expected = input;
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert hr box', () => {
    const input = `<lake-box name="hr"></lake-box>`;
    const expected = '<div class="lake-box-block lake-hr"><hr /></div>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert image box with all attributes', () => {
    const val = createBoxValue({ url: 'a.png', width: '100', height: '200', caption: 'foo' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    const expected = '<img src="a.png" width="100" height="200" alt="foo" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert image box without width and height', () => {
    const val = createBoxValue({ url: 'a.png' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    const expected = '<img src="a.png" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert image box with empty values', () => {
    const input = '<lake-box data-hidden name="image" value="e30="></lake-box>';
    const expected = '<img src="undefined" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert image box if value attribute is missing', () => {
    const input = '<lake-box name="image"></lake-box>';
    const expected = '<img src="undefined" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert emoji box', () => {
    const val = createBoxValue({ url: 'smile.png' });
    const input = `<lake-box name="emoji" value="${val}"></lake-box>`;
    const expected = '<img src="smile.png" width="32" height="32" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert file box', () => {
    const val = createBoxValue({ url: 'smile.png', name: 'smile' });
    const input = `<lake-box name="file" value="${val}"></lake-box>`;
    const expected = '<a href="smile.png" target="_blank">smile</a>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert codeBlock box', () => {
    const val = createBoxValue({ lang: 'html', code: '<p class="foo">bar</p>' });
    const input = `<lake-box name="codeBlock" value="${val}"></lake-box>`;
    const expected = '<pre class="lang-html"><code>&lt;p class=&quot;foo&quot;&gt;bar&lt;/p&gt;</code></pre>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert equation box', () => {
    const val = createBoxValue({ code: 'a^2-b^2=(a+b)(a-b)' });
    const input = `<lake-box name="equation" value="${val}"></lake-box>`;
    const expected = '<code>a^2-b^2=(a+b)(a-b)</code>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert video box', () => {
    const val = createBoxValue({ url: 'https://www.youtube.com/watch?v=5sMBhDv4sik' });
    const input = `<lake-box name="video" value="${val}"></lake-box>`;
    const expected = '<iframe src="https://www.youtube.com/embed/5sMBhDv4sik" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen="true" style="width: 560px; height: 315px;"></iframe>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert twitter box', () => {
    const val = createBoxValue({ url: 'https://x.com/Interior/status/463440424141459456' });
    const input = `<lake-box name="twitter" value="${val}"></lake-box>`;
    const expected = '<iframe src="https://platform.twitter.com/embed/Tweet.html?id=463440424141459456" title="Twitter tweet" scrolling="no" frameborder="0" allowtransparency="true" allowfullscreen="true" style="width: 550px; height: 300px;"></iframe>';
    expect(toHTML(input)).toBe(expected);
  });

  it('should encode reserved characters in attributes', () => {
    const val = createBoxValue({ url: 'a.png?id=1&name=<tag>"\xA0' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    // & -> &amp;, < -> &lt;, " -> &quot;
    expect(toHTML(input)).toContain('src="a.png?id=1&amp;name=&lt;tag&gt;&quot;&nbsp;"');
  });

  it('should parse attributes with different quote styles (getAttributes coverage)', () => {
    // Covers: single quotes, no quotes, and double quotes in getAttributes regex
    const val = createBoxValue({ url: 'test.png' });
    const input = `<lake-box name='image' value=${val}></lake-box>`;
    expect(toHTML(input)).toContain('src="test.png"');
  });

  it('should handle multibyte characters in Base64 (UTF-8 support)', () => {
    const val = createBoxValue({ url: '图片.png' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    expect(toHTML(input)).toContain('src="图片.png"');
  });

  it('should handle lake-box tags that do not have a closing tag', () => {
    const val = createBoxValue({ url: 'a.png' });
    const input = `<lake-box name="image" value="${val}">`;
    expect(toHTML(input)).toContain('<img');
  });

  it('should return empty string if box name is not found in config', () => {
    const input = '<lake-box name="unknown" value="e30="></lake-box>';
    expect(toHTML(input)).toBe('');
  });

  it('should return empty string and log error if JSON/Base64 parsing fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const input = '<lake-box name="image" value="invalid-base64!"></lake-box>';
    expect(toHTML(input)).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse lake-box value:', expect.any(Error));
  });

});
