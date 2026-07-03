import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { aiService } from '../../services/ai.service';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export const createDocument = async (
  userId: string,
  file: Express.Multer.File
) => {
  const doc = await prisma.theoryDocument.create({
    data: {
      userId,
      filename: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'PENDING',
    },
  });

  // Kick off async processing — do not await
  // Use absolute path so the Python service can find the file regardless of its cwd
  processDocumentAsync(doc.id, userId, path.resolve(file.path)).catch((err) =>
    logger.error(`Background document processing failed for ${doc.id}:`, err)
  );

  return doc;
};

const processDocumentAsync = async (
  docId: string,
  userId: string,
  filePath: string
): Promise<void> => {
  await prisma.theoryDocument.update({
    where: { id: docId },
    data: { status: 'PROCESSING' },
  });

  try {
    const result = await aiService.processDocument(docId, userId, filePath);

    await prisma.theoryDocument.update({
      where: { id: docId },
      data: {
        status:          'READY',
        chunkCount:      result.chunkCount,
        textChunkCount:  result.textChunkCount,
        imageChunkCount: result.imageChunkCount,
      },
    });

    logger.info(
      `Document ${docId} processed: ${result.chunkCount} chunks ` +
      `(${result.textChunkCount} text + ${result.imageChunkCount} image)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    await prisma.theoryDocument.update({
      where: { id: docId },
      data: { status: 'FAILED', errorMessage: message },
    });
    throw error;
  }
};

export const getUserDocuments = async (userId: string) => {
  return prisma.theoryDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      status: true,
      chunkCount: true,
      textChunkCount: true,
      imageChunkCount: true,
      errorMessage: true,
      createdAt: true,
    },
  });
};

export const deleteDocument = async (docId: string, userId: string): Promise<void> => {
  const doc = await prisma.theoryDocument.findFirst({
    where: { id: docId, userId },
  });

  if (!doc) throw new AppError('Document not found', 404);

  // Delete from pgvector via Python service
  try {
    await aiService.deleteDocumentChunks(docId);
  } catch (err) {
    logger.warn(`Could not delete pgvector chunks for ${docId}:`, err);
  }

  // Delete file from disk
  if (fs.existsSync(doc.filePath)) {
    fs.unlinkSync(doc.filePath);
  }

  await prisma.theoryDocument.delete({ where: { id: docId } });
};

export const reprocessDocument = async (docId: string, userId: string) => {
  const doc = await prisma.theoryDocument.findFirst({
    where: { id: docId, userId },
  });

  if (!doc) throw new AppError('Document not found', 404);
  if (!fs.existsSync(doc.filePath)) {
    throw new AppError('Original file not found on disk', 404);
  }

  // Delete old chunks first
  try {
    await aiService.deleteDocumentChunks(docId);
  } catch (err) {
    logger.warn(`Could not clear old chunks for ${docId}:`, err);
  }

  processDocumentAsync(docId, userId, doc.filePath).catch((err) =>
    logger.error(`Reprocess failed for ${docId}:`, err)
  );

  return prisma.theoryDocument.update({
    where: { id: docId },
    data: { status: 'PENDING', chunkCount: 0, errorMessage: null },
  });
};
