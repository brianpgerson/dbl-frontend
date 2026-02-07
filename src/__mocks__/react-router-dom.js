const React = require('react');

module.exports = {
  BrowserRouter: ({ children }) => React.createElement('div', null, children),
  Routes: ({ children }) => React.createElement('div', null, children),
  Route: ({ element }) => element,
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  Link: ({ children, to }) => React.createElement('a', { href: to }, children),
  NavLink: ({ children, to }) => React.createElement('a', { href: to }, children),
};
