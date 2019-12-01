import { toDom } from 'abstract-ui/to_dom.js';

/* TODO:
 */

const DEV = process.env.NODE_ENV != 'production';

const GLOBAL = {
  routes: {},
  onRouteMounts() {},
  onRouteUnMounts() {}
};

function replaceContainer(pageNode) {
  GLOBAL.root.innerHTML = '';
  GLOBAL.root.appendChild(pageNode);
}

async function ErrorPage({ route }) {
  try {
    const ErrorComponent = await GLOBAL.imports('404');
    return ErrorComponent.default(route);
  } catch (_) {
    if (DEV) {
      console.warn(
        'error happend while fetching error page, either it does not exist or error page component has an error.'
      );
      console.error(_);
    }
    return (
      <div style='margin: 1rem;'>
        <h1 style='margin-bottom: 1rem;'>404 | Route Not Found</h1>
        <p>sorry, we couldn't find the requested page:</p>
        <div style='display: flex; justify-content: start; margin-top: .5rem;'>
          <p style='background-color: #E2E8F0;'>{route}</p>
        </div>
      </div>
    );
  }
}

function initGlobal({ imports, root }) {
  GLOBAL.imports = imports;
  GLOBAL.root = root;
}

function resolvePageName(pathname) {
  // handle dynamic naming eg. products@[someId]
  if (pathname == '/') {
    return 'index';
  } else {
    const transformSlash = pathname.replace(/\//g, '@').substring(1, pathname.length);
    return transformSlash[transformSlash.length - 1] == '@'
      ? transformSlash.substring(0, transformSlash.length - 1)
      : transformSlash;
  }
}

function resolveDynamicPage(pathname) {
  const [page, ...parts] = pathname.split('/').filter(Boolean);
  return { page: `${page}.dynamic`, dynamic: parts };
}

function renderPageComponent(component, routeToCache, payload) {
  const ctx = payload ? { ...payload } : {};
  const domNode = toDom(typeof component == 'function' ? component(ctx) : component);
  GLOBAL.routes[routeToCache] = domNode; // cache the page DOM Node.
  replaceContainer(domNode); // flush to dom router root.
}

function renderRoute(route, data = {}) {
  // renders the route and if it is not found render error
  // executes side effects
  const resolvedModuleFromPathname = resolvePageName(route);
  const dynamicParts = resolveDynamicPage(route);

  (async () => {
    try {
      const { default: PageComponent } = await GLOBAL.imports(resolvedModuleFromPathname);
      renderPageComponent(PageComponent, route, data);
    } catch (error) {
      try {
        const { default: PageComponent } = await GLOBAL.imports(dynamicParts.page);
        renderPageComponent(PageComponent, route, { dynamic: dynamicParts.dynamic, ...data });
      } catch (_error) {
        if (DEV) {
          console.error('DEVELOPMENT ERROR\n', _error);
        }
        ErrorPage({ route }).then(component => {
          renderPageComponent(component, route);
        });
      }
    }
  })();
}

function init_router(routerConfig) {
  initGlobal(routerConfig);
  renderRoute(window.location.pathname);

  window.addEventListener('popstate', function(event) {
    if (GLOBAL.routes[window.location.pathname]) {
      replaceContainer(GLOBAL.routes[window.location.pathname]);
    } else {
      renderRoute(window.location.pathname);
    }
  });
}

/* API */
export function Router({ imports }) {
  return (
    <div
      ref={rootRef => {
        init_router({ imports, root: rootRef });
      }}
    />
  );
}

export function Link({ href, data = {}, children = [] }) {
  const ChildComponent = children[0];
  ChildComponent.props.tabIndex = '0';
  ChildComponent.props.href = href;
  ChildComponent.props.onClick = function(e) {
    e.preventDefault();
    if (href == window.location.pathname) {
      return;
    }
    window.history.pushState({}, '', href);
    if (GLOBAL.routes[href]) {
      replaceContainer(GLOBAL.routes[href]);
    } else {
      renderRoute(window.location.pathname, data);
    }
  };
  return ChildComponent;
}

export function Head() {}
