const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { pipeline } = require("stream");

const PRIVATE_UPLOAD_DIR = path.resolve(
  process.env.BOOK_UPLOAD_DIR || path.join(__dirname, "../private-uploads"),
);
const MAX_MANUSCRIPT_SIZE = 20 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;

const allowedTypes = {
  manuscript: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  cover: new Set(["image/jpeg", "image/png", "image/webp"]),
};

const storage = {
  _handleFile(req, file, callback) {
    const filename = `${crypto.randomUUID()}.upload`;
    const filePath = path.join(PRIVATE_UPLOAD_DIR, filename);
    fs.mkdir(PRIVATE_UPLOAD_DIR, { recursive: true, mode: 0o700 }, (mkdirError) => {
      if (mkdirError) {
        callback(mkdirError);
        return;
      }
      fs.chmod(PRIVATE_UPLOAD_DIR, 0o700, (chmodError) => {
        if (chmodError) {
          callback(chmodError);
          return;
        }
        const output = fs.createWriteStream(filePath, { flags: "wx", mode: 0o600 });
        pipeline(file.stream, output, (writeError) => {
          if (writeError) {
            fs.rm(filePath, { force: true }, () => callback(writeError));
            return;
          }
          fs.stat(filePath, (statError, stat) => {
            if (statError) {
              callback(statError);
              return;
            }
            callback(null, {
              destination: PRIVATE_UPLOAD_DIR,
              filename,
              path: filePath,
              size: stat.size,
            });
          });
        });
      });
    });
  },
  _removeFile(req, file, callback) {
    fs.rm(file.path, { force: true }, callback);
  },
};

const upload = multer({
  storage,
  limits: {
    fields: 12,
    files: 2,
    fieldSize: 40 * 1024,
    parts: 14,
    fileSize: MAX_MANUSCRIPT_SIZE,
  },
  fileFilter(req, file, callback) {
    const field = file.fieldname === "manuscript" ? "manuscript" : "cover";
    const extension = path.extname(file.originalname).toLowerCase();
    const validExtension = field === "manuscript"
      ? (extension === ".pdf" || extension === ".docx")
      : [".jpg", ".jpeg", ".png", ".webp"].includes(extension);
    if (!allowedTypes[field].has(file.mimetype) || !validExtension) {
      callback(new Error(`Unsupported ${field} file type`));
      return;
    }
    callback(null, true);
  },
});

function parseBookFiles(req, res, next) {
  upload.fields([
    { name: "manuscript", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    removeUploadedFiles(req.files).catch((cleanupError) => {
      console.error("Failed to clean rejected book upload:", cleanupError.message);
    });
    const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? 413
      : 400;
    res.status(status).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the size limit"
        : error.message || "Invalid upload",
    });
  });
}

async function removeUploadedFiles(files = {}) {
  const paths = Object.values(files).flat().map((file) => file.path);
  await Promise.all(paths.map((filePath) => fs.promises.rm(filePath, { force: true })));
}

async function validateFileSignature(file, type) {
  if (!file) return true;

  const handle = await fs.promises.open(file.path, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);

    if (type === "manuscript" && file.mimetype === "application/pdf") {
      return header.subarray(0, 5).toString() === "%PDF-";
    }
    if (type === "manuscript") {
      return header[0] === 0x50 && header[1] === 0x4b;
    }
    if (file.mimetype === "image/png") {
      return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (file.mimetype === "image/jpeg") {
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    return header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP";
  } finally {
    await handle.close();
  }
}

function toPrivateFile(file) {
  if (!file) return undefined;
  const originalName = path.basename(file.originalname).replace(/[\\/\x00-\x1f\x7f]/g, "").slice(0, 255);
  return {
    storageName: path.basename(file.filename),
    originalName,
    mimeType: file.mimetype,
    size: file.size,
  };
}

module.exports = {
  PRIVATE_UPLOAD_DIR,
  MAX_MANUSCRIPT_SIZE,
  MAX_COVER_SIZE,
  parseBookFiles,
  removeUploadedFiles,
  toPrivateFile,
  validateFileSignature,
};
