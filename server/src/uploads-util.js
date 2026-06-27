'use strict';

const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./db');

// Uploads are stored encrypted on disk as "<logicalName>.enc". The DB and the
// rest of the app only ever deal with the logical name (e.g. "ab12...cd.png");
// this module is the single place that maps a logical name to its on-disk path.

function diskPathFor(logicalName) {
  return path.join(UPLOADS_DIR, logicalName + '.enc');
}

// Best-effort delete of an upload by its logical name (ignores a missing file).
function removeUpload(logicalName) {
  if (!logicalName) return;
  try {
    fs.unlinkSync(diskPathFor(logicalName));
  } catch (_) {
    /* file may already be gone */
  }
}

module.exports = { UPLOADS_DIR, diskPathFor, removeUpload };
