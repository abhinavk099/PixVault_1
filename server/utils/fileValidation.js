const mime = require('mime-types');
const FileType = require('file-type');
const path = require('path');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const ClamScan = require('clamscan');

// Initialize ClamAV scanner
const clamscan = new ClamScan({
    removeInfected: true,
    quarantineInfected: false,
    scanLog: null,
    debugMode: false,
    fileList: null,
    scanTimeout: 60000,
    preference: 'clamdscan'
});

class FileValidationService {
    static ALLOWED_MIME_TYPES = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain'
    ]);

    static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    /**
     * Validate file size, type, and scan for viruses
     * @param {string} filePath - Path to the file
     * @param {string} originalName - Original filename
     * @returns {Promise<{isValid: boolean, error: string|null}>}
     */
    static async validateFile(filePath, originalName) {
        try {
            // Check if file exists
            await fs.access(filePath);

            // Get file stats
            const stats = await fs.stat(filePath);
            
            // Check file size
            if (stats.size > this.MAX_FILE_SIZE) {
                return {
                    isValid: false,
                    error: 'File size exceeds maximum allowed size'
                };
            }

            // Check file type
            const fileType = await FileType.fromFile(filePath);
            const mimeType = fileType ? fileType.mime : mime.lookup(originalName);

            if (!mimeType || !this.ALLOWED_MIME_TYPES.has(mimeType)) {
                return {
                    isValid: false,
                    error: 'File type not allowed'
                };
            }

            // Scan for viruses
            try {
                const {isInfected, virusName} = await clamscan.isInfected(filePath);
                if (isInfected) {
                    return {
                        isValid: false,
                        error: `File is infected with ${virusName}`
                    };
                }
            } catch (error) {
                console.error('Virus scan error:', error);
                // If virus scanning fails, we should err on the side of caution
                return {
                    isValid: false,
                    error: 'Unable to verify file safety'
                };
            }

            // Check file extension
            const ext = path.extname(originalName).toLowerCase();
            const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt'];
            
            if (!allowedExtensions.includes(ext)) {
                return {
                    isValid: false,
                    error: 'File extension not allowed'
                };
            }

            // All checks passed
            return {
                isValid: true,
                error: null
            };
        } catch (error) {
            return {
                isValid: false,
                error: 'File validation failed: ' + error.message
            };
        }
    }

    /**
     * Calculate file hash for integrity verification
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} SHA-256 hash of the file
     */
    static async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);

            stream.on('error', err => reject(err));
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    /**
     * Check if file content matches its extension
     * @param {string} filePath - Path to the file
     * @param {string} originalName - Original filename
     * @returns {Promise<boolean>}
     */
    static async validateFileContent(filePath, originalName) {
        const fileType = await FileType.fromFile(filePath);
        if (!fileType) {
            // If file type can't be determined, fall back to extension check
            return true;
        }

        const expectedMime = mime.lookup(originalName);
        return fileType.mime === expectedMime;
    }
}

module.exports = FileValidationService;
