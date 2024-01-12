// Sourced from Node: https://github.com/nodejs/node/blob/main/lib/path.js
// This file is licensed as:
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

const process = require("process");

const CHAR_UPPERCASE_A = "A".charCodeAt(0);
const CHAR_LOWERCASE_A = "a".charCodeAt(0);
const CHAR_UPPERCASE_Z = "Z".charCodeAt(0);
const CHAR_LOWERCASE_Z = "z".charCodeAt(0);
const CHAR_DOT = ".".charCodeAt(0);
const CHAR_FORWARD_SLASH = "/".charCodeAt(0);
const CHAR_BACKWARD_SLASH = "\\".charCodeAt(0);
const CHAR_COLON = ":".charCodeAt(0);
const CHAR_QUESTION_MARK = "?".charCodeAt(0);

function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}

function isWindowsDeviceRoot(code) {
  return (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z) ||
         (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z);
}

// Resolves . and .. elements in a path with directory names
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
  let res = '';
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (isPathSeparator(code))
      break;
    else
      code = CHAR_FORWARD_SLASH;

    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 ||
            res.charCodeAt(res.length - 1) !== CHAR_DOT ||
            res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = '';
              lastSegmentLength = 0;
            } else {
              res = StringPrototypeSlice(res, 0, lastSlashIndex);
              lastSegmentLength =
                res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? `${separator}..` : '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += `${separator}${path.slice(lastSlash + 1, i)}`;
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function resolveWin32(...args) {
  let resolvedDevice = '';
  let resolvedTail = '';
  let resolvedAbsolute = false;

  for (let i = args.length - 1; i >= -1; i--) {
    let path;
    if (i >= 0) {
      path = args[i];
      if (typeof path !== "string") {
        throw new TypeError(`paths[${i}]`);
      }

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }
    } else if (resolvedDevice.length === 0) {
      path = process.cwd();
    } else {
      // Windows has the concept of drive-specific current working
      // directories. If we've resolved a drive letter but not yet an
      // absolute path, get cwd for that drive, or the process cwd if
      // the drive cwd is not available. We're sure the device is not
      // a UNC path at this points, because UNC paths are always absolute.
      path = process.env[`=${resolvedDevice}`] || process.cwd();

      // Verify that a cwd was found and that it actually points
      // to our drive. If not, default to the drive's root.
      if (path === undefined ||
          (path.slice(0, 2).toLowerCase() !==
          resolvedDevice.toLowerCase() &&
          path.charCodeAt(2) === CHAR_BACKWARD_SLASH)) {
        path = `${resolvedDevice}\\`;
      }
    }

    const len = path.length;
    let rootEnd = 0;
    let device = '';
    let isAbsolute = false;
    const code = path.charCodeAt(0);

    // Try to match a root
    if (len === 1) {
      if (isPathSeparator(code)) {
        // `path` contains just a path separator
        rootEnd = 1;
        isAbsolute = true;
      }
    } else if (isPathSeparator(code)) {
      // Possible UNC root

      // If we started with a separator, we know we at least have an
      // absolute path of some kind (UNC or otherwise)
      isAbsolute = true;

      if (isPathSeparator(path.charCodeAt(1))) {
        // Matched double path separator at beginning
        let j = 2;
        let last = j;
        // Match 1 or more non-path separators
        while (j < len &&
               !isPathSeparator(path.charCodeAt(j))) {
          j++;
        }
        if (j < len && j !== last) {
          const firstPart = path.slice(last, j);
          // Matched!
          last = j;
          // Match 1 or more path separators
          while (j < len &&
                 isPathSeparator(path.charCodeAt(j))) {
            j++;
          }
          if (j < len && j !== last) {
            // Matched!
            last = j;
            // Match 1 or more non-path separators
            while (j < len &&
                   !isPathSeparator(path.charCodeAt(j))) {
              j++;
            }
            if (j === len || j !== last) {
              // We matched a UNC root
              device =
                `\\\\${firstPart}\\${path.slice(last, j)}`;
              rootEnd = j;
            }
          } else if (j === len || j !== last) {
            // We matched a UNC root
            device =
              `\\\\${firstPart}`;
            rootEnd = j;
          }
        } else if (j === len || j !== last) {
          // We matched a UNC root
          const firstPart = path.slice(last, j);
          device =
            `\\\\${firstPart}`;
          rootEnd = j;
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code) &&
                path.charCodeAt(1) === CHAR_COLON) {
      // Possible device root
      device = path.slice(0, 2);
      rootEnd = 2;
      if (len > 2 && isPathSeparator(path.charCodeAt(2))) {
        // Treat separator following drive name as an absolute path
        // indicator
        isAbsolute = true;
        rootEnd = 3;
      }
    }

    if (device.length > 0) {
      if (resolvedDevice.length > 0) {
        if (device.toLowerCase() !==
            resolvedDevice.toLowerCase())
          // This path points to another device so it is not applicable
          continue;
      } else {
        resolvedDevice = device;
      }
    }

    if (resolvedAbsolute) {
      if (resolvedDevice.length > 0)
        break;
    } else {
      resolvedTail =
        `${path.slice(rootEnd)}\\${resolvedTail}`;
      resolvedAbsolute = isAbsolute;
      if (isAbsolute && resolvedDevice.length > 0) {
        break;
      }
    }
  }

  // At this point the path should be resolved to a full absolute path,
  // but handle relative paths to be safe (might happen when process.cwd()
  // fails)

  // Normalize the tail path
  resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, '\\',
                                 isPathSeparator);

  return resolvedAbsolute ?
    `${resolvedDevice}\\${resolvedTail}` :
    `${resolvedDevice}${resolvedTail}` || '.';
}

function toNamespacedPathWin32(path) {
  // Note: this will *probably* throw somewhere.
  if (typeof path !== 'string' || path.length === 0)
    return path;

  const resolvedPath = resolveWin32(path);

  if (resolvedPath.length <= 2)
    return path;

  if (resolvedPath.charCodeAt(0) === CHAR_BACKWARD_SLASH) {
    // Possible UNC root
    if (resolvedPath.charCodeAt(1) === CHAR_BACKWARD_SLASH) {
      const code = resolvedPath.charCodeAt(2);
      if (code !== CHAR_QUESTION_MARK && code !== CHAR_DOT) {
        // Matched non-long UNC root, convert the path to a long UNC path
        return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
      }
    }
  } else if (
    isWindowsDeviceRoot(resolvedPath.charCodeAt(0)) &&
    resolvedPath.charCodeAt(1) === CHAR_COLON &&
    resolvedPath.charCodeAt(2) === CHAR_BACKWARD_SLASH
  ) {
    // Matched device root, convert the path to a long UNC path
    return `\\\\?\\${resolvedPath}`;
  }

  return path;
}

module.exports = {
  normalizeString,
  resolveWin32,
  toNamespacedPathWin32
};
