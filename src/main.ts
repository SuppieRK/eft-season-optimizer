import './typography.css';
import './spacing.css';
import './layout.css';
import './styles.css';

import { loadCatalogs } from './catalogs';
import { browserCookieAdapter, restoreState, saveState } from './persistence';
import { renderApp } from './render';
import { reduceState } from './state';

void loadCatalogs()
  .then((catalogs) => {
    let state = restoreState(browserCookieAdapter, catalogs);
    const dispatch = (action: Parameters<typeof reduceState>[1]): void => {
      state = reduceState(state, action, catalogs);
      try {
        saveState(state, browserCookieAdapter, catalogs);
      } catch (error) {
        console.error(error);
      }
      renderApp(document, catalogs, state, dispatch);
    };
    renderApp(document, catalogs, state, dispatch);
  })
  .catch((error: unknown) => console.error(error));
