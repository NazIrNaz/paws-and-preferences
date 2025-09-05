// Import the initApp function from app.ts
import { initApp } from './app';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, initializing app...');
  initApp();
});

// Also try to initialize immediately in case DOM is already loaded
if (document.readyState !== 'loading') {
  console.log('DOM already loaded, initializing app immediately');
  initApp();
}
