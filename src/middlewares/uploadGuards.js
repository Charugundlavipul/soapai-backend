export const mustBeMemoryStorage = (fieldLabel = 'file') => (req, _res, next) => {
  const all = req.file ? [req.file] : (req.files || []);
  if (!all.length) return next();

  for (const f of all) {
    if ('path' in f || 'destination' in f || 'filename' in f) {
      return next(new Error(
        `Disk storage detected for "${fieldLabel}". Remove any multer.diskStorage or dest:'uploads/' usage.`
      ));
    }
    if (!f.buffer) {
      return next(new Error(`No in-memory buffer for "${fieldLabel}". memoryStorage is required.`));
    }
  }
  next();
};
