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
    expect(toHTML(input)).toBe('Helloworld');
  });

  it('should return original text if no special tags are matched', () => {
    const input = '<p>Normal HTML content</p>';
    expect(toHTML(input)).toBe('<p>Normal HTML content</p>');
  });

  it('should convert image box with all attributes', () => {
    const val = createBoxValue({ url: 'a.png', width: '100', height: '200' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    const expected = '<img src="a.png" width="100" height="200" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should omit width and height if not provided in boxValue', () => {
    const val = createBoxValue({ url: 'a.png' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    const expected = '<img src="a.png" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('should convert emoji box with fixed 32x32 dimensions', () => {
    const val = createBoxValue({ url: 'smile.png' });
    const input = `<lake-box name="emoji" value="${val}"></lake-box>`;
    const expected = '<img src="smile.png" width="32" height="32" border="0" />';
    expect(toHTML(input)).toBe(expected);
  });

  it('returns empty string for unknown box names', () => {
    const input = '<lake-box name="unknown" value="e30="></lake-box>';
    expect(toHTML(input)).toBe('');
  });

  it('should encode reserved characters in attributes', () => {
    const val = createBoxValue({ url: 'a.png?id=1&name=<tag>"' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    // & -> &amp;, < -> &lt;, " -> &quot;
    expect(toHTML(input)).toContain('src="a.png?id=1&amp;name=&lt;tag&gt;&quot;"');
  });

  it('should parse attributes with different quote styles (getAttributes coverage)', () => {
    // Covers: single quotes, no quotes, and double quotes in getAttributes regex
    const val = createBoxValue({ url: 'test.png' });
    const input = `<lake-box name='image' value=${val}></lake-box>`;
    expect(toHTML(input)).toContain('src="test.png"');
  });

  it('should handle attributes without values (image)', () => {
    const input = '<lake-box data-hidden name="image" value="e30="></lake-box>';
    expect(toHTML(input)).toBe('<img border="0" />');
  });

  it('should handle attributes without values (emoji)', () => {
    const input = '<lake-box data-hidden name="emoji" value="e30="></lake-box>';
    expect(toHTML(input)).toBe('<img width="32" height="32" border="0" />');
  });

  it('should return empty string if box name is not found in imageTypes', () => {
    const input = '<lake-box name="unknown" value="e30="></lake-box>';
    expect(toHTML(input)).toBe('');
  });

  it('should return empty string if value attribute is missing', () => {
    const input = '<lake-box name="image"></lake-box>';
    expect(toHTML(input)).toBe('');
  });

  it('should return empty string and log error if JSON/Base64 parsing fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const input = '<lake-box name="image" value="invalid-base64!"></lake-box>';
    expect(toHTML(input)).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse lake-box value:', expect.any(Error));
  });

  it('should handle multibyte characters in Base64 (UTF-8 support)', () => {
    const val = createBoxValue({ url: '图片.png' });
    const input = `<lake-box name="image" value="${val}"></lake-box>`;
    expect(toHTML(input)).toContain('src="图片.png"');
  });

  it('should handle lake-box tags that do not have a closing tag', () => {
    const val = createBoxValue({ url: 'a.png' });
    const input = `<lake-box name="image" value="${val}">`;
    expect(toHTML(input)).toBe('<img src="a.png" border="0" />');
  });

});
