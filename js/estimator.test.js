import { describe, it, expect } from 'vitest';
import { wordCount, readTimeSeconds } from './estimator.js';

describe('wordCount', () => {
  it('counts words separated by single spaces', () => {
    expect(wordCount('hello world foo')).toBe(3);
  });

  it('handles multiple whitespace types', () => {
    expect(wordCount('hello   world\nfoo\tbar')).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(wordCount('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(wordCount('   \n  \t')).toBe(0);
  });

  it('counts a single word', () => {
    expect(wordCount('hello')).toBe(1);
  });

  it('strips punctuation but keeps the word', () => {
    expect(wordCount('hello, world.')).toBe(2);
  });
});

describe('readTimeSeconds', () => {
  it('returns 60 seconds for 150 words at speed 1.0 (150 wpm baseline)', () => {
    const seconds = readTimeSeconds(150, 1.0);
    expect(seconds).toBe(60);
  });

  it('halves the time at speed 2.0', () => {
    expect(readTimeSeconds(150, 2.0)).toBe(30);
  });

  it('doubles the time at speed 0.5', () => {
    expect(readTimeSeconds(150, 0.5)).toBe(120);
  });

  it('returns 0 for zero words', () => {
    expect(readTimeSeconds(0, 1.0)).toBe(0);
  });

  it('rounds to whole seconds', () => {
    expect(readTimeSeconds(100, 1.0)).toBe(40);
  });
});
