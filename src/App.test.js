import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

jest.mock('./Config/apiClient');

// The app itself is mounted under a BrowserRouter in index.js, so the test supplies a router.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the login page to a visitor with no session', () => {
    const { container } = renderAt('/');

    expect(container.querySelector('.login-page')).toBeInTheDocument();
  });

  it('shows the forgot-password page at /forgotpassword', () => {
    const { container } = renderAt('/forgotpassword');

    expect(container.querySelector('.login-page')).not.toBeInTheDocument();
    expect(container.querySelector('.container')).toBeInTheDocument();
  });

  it('does not let a visitor with no session into the master area', () => {
    const { container } = renderAt('/master/marg-import');

    expect(container.querySelector('.afx-title, .bulkup-page')).not.toBeInTheDocument();
  });
});
