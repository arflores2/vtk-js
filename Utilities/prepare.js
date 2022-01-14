if (process.env.CI === undefined) {
  try {
    require('husky').install();
  } catch (e) {
    // error out, but don't break install
    console.warn('Something went wrong aflores');
    console.warn('[husky warning]:', e.message);
  }
}
