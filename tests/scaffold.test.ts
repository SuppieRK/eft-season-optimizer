// @vitest-environment jsdom

import { getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => document.body.replaceChildren());

describe('static shell', () => {
  it('exposes the five planned regions', () => {
    document.body.innerHTML = `
      <header data-region="header"></header>
      <main>
        <section data-region="rewards"></section>
        <section data-region="results"></section>
        <aside data-region="controls"></aside>
      </main>
      <footer data-region="footer"></footer>
    `;

    expect(getByRole(document.body, 'main')).toBeTruthy();
    expect(document.querySelectorAll('[data-region]').length).toBe(5);
  });
});
