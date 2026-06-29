import * as fs from 'fs';
import * as path from 'path';
import { jsPDF } from 'jspdf';
import { Task } from '../types';
import { StorageService } from './storage';

export class PdfService {
  /**
   * Exports a task to a PDF file on the local filesystem.
   * Returns the absolute path of the generated PDF.
   */
  public static async exportTask(task: Task, outputPath?: string): Promise<string> {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210; // A4 dimensions
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let y = 20;

    // Helper to add new page if content overflows
    const checkPageOverflow = (heightNeeded: number) => {
      if (y + heightNeeded > 280) {
        doc.addPage();
        y = 20;
      }
    };

    // 1. Task Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    const titleLines = doc.splitTextToSize(task.title, contentWidth);
    checkPageOverflow(titleLines.length * 8);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 8) + 5;

    // 2. Metadata (Status, Dates, Tags)
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    const createdStr = `Created: ${new Date(task.createdDate).toLocaleDateString()}`;
    const updatedStr = `Updated: ${new Date(task.updatedDate).toLocaleDateString()}`;
    const statusStr = `Status: ${task.status}`;
    const tagsStr = `Tags: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}`;
    
    checkPageOverflow(15);
    doc.text(`${statusStr}  |  ${createdStr}  |  ${updatedStr}`, margin, y);
    y += 5;
    doc.text(tagsStr, margin, y);
    y += 10;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // 3. Git / Repository Info
    if (task.repository && task.repository.repositoryName) {
      checkPageOverflow(30);
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, contentWidth, 22, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('REPOSITORY INFORMATION', margin + 3, y + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Repo: ${task.repository.repositoryName}`, margin + 3, y + 10);
      doc.text(`Branch: ${task.repository.branch || 'N/A'}`, margin + 3, y + 14);
      doc.text(`Commit URL: ${task.repository.commitUrl || 'N/A'}`, margin + 3, y + 18);
      if (task.repository.runbotUrl) {
        doc.text(`Runbot URL: ${task.repository.runbotUrl}`, margin + 90, y + 10);
      }
      y += 27;
    }

    // 4. Description
    if (task.description && task.description.trim()) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      checkPageOverflow(10);
      doc.text('Description', margin, y);
      y += 6;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(task.description, contentWidth);
      checkPageOverflow(descLines.length * 5);
      doc.text(descLines, margin, y);
      y += (descLines.length * 5) + 8;
    }

    // 5. Notes (Markdown Text)
    if (task.notes && task.notes.trim()) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      checkPageOverflow(10);
      doc.text('Notes', margin, y);
      y += 6;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      
      // Clean simple markdown stripping for text rendering
      const cleanNotes = task.notes
        .replace(/#+\s+(.*)/g, '$1') // Header markers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold markers
        .replace(/\*([^*]+)\*/g, '$1') // Italic markers
        .replace(/`([^`]+)`/g, '$1'); // Inline code markers

      const notesLines = doc.splitTextToSize(cleanNotes, contentWidth);
      
      // Print lines checking page boundary
      for (const line of notesLines) {
        checkPageOverflow(5);
        doc.text(line, margin, y);
        y += 5;
      }
      y += 5;
    }

    // 6. Embedded Images
    if (task.images && task.images.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      checkPageOverflow(15);
      doc.text('Images', margin, y);
      y += 8;

      const baseDir = StorageService.getBaseDir();

      for (const imgRelPath of task.images) {
        const fullImgPath = path.isAbsolute(imgRelPath) ? imgRelPath : path.join(baseDir, imgRelPath);
        if (fs.existsSync(fullImgPath)) {
          try {
            const ext = path.extname(fullImgPath).substring(1).toUpperCase() as 'PNG' | 'JPEG' | 'JPG';
            const imgData = fs.readFileSync(fullImgPath);
            const base64Img = imgData.toString('base64');
            
            // Standard image dimensions
            const imgHeight = 60;
            const imgWidth = 90;

            checkPageOverflow(imgHeight + 10);
            
            // Add image to PDF
            doc.addImage(`data:image/${ext.toLowerCase()};base64,${base64Img}`, ext, margin, y, imgWidth, imgHeight);
            y += imgHeight + 8;
          } catch (e) {
            console.error('Error adding image to PDF:', e);
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(150, 0, 0);
            checkPageOverflow(6);
            doc.text(`[Error loading image: ${path.basename(imgRelPath)}]`, margin, y);
            y += 6;
            doc.setTextColor(0, 0, 0);
          }
        }
      }
      y += 5;
    }

    // 7. Code Snippets
    if (task.snippets && task.snippets.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      checkPageOverflow(15);
      doc.text('Code Snippets', margin, y);
      y += 8;

      for (const snippet of task.snippets) {
        checkPageOverflow(30);

        // Snippet Header
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(snippet.title || 'Untitled Snippet', margin, y);
        y += 4.5;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`File: ${snippet.file} (Lines ${snippet.startLine}-${snippet.endLine})`, margin, y);
        y += 4;
        if (snippet.description) {
          doc.text(`Desc: ${snippet.description}`, margin, y);
          y += 4.5;
        }

        // Code Block
        doc.setTextColor(0, 0, 0);
        doc.setFont('Courier', 'normal');
        doc.setFontSize(8);

        const codeLines = doc.splitTextToSize(snippet.selectedCode, contentWidth - 6);
        const codeBlockHeight = (codeLines.length * 3.5) + 6;

        checkPageOverflow(codeBlockHeight + 5);

        // Light gray background block for code
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, y, contentWidth, codeBlockHeight, 'F');

        let codeY = y + 4.5;
        for (const line of codeLines) {
          // Inner check for code lines to wrap safely to next page if needed
          if (codeY > 280) {
            doc.addPage();
            y = 20;
            // Redraw background block on new page
            const remainingLinesCount = codeLines.length - codeLines.indexOf(line);
            const remainingHeight = (remainingLinesCount * 3.5) + 6;
            doc.setFillColor(248, 249, 250);
            doc.rect(margin, y, contentWidth, remainingHeight, 'F');
            codeY = y + 4.5;
          }
          doc.text(line, margin + 3, codeY);
          codeY += 3.5;
        }

        y = codeY + 5;
        // Reset fonts
        doc.setFont('Helvetica', 'normal');
      }
    }

    // Determine final output path
    const pdfName = `task_${task.id}_${Date.now()}.pdf`;
    const finalPath = outputPath || path.join(StorageService.getExportsDir(), pdfName);
    
    const pdfBuf = doc.output('arraybuffer');
    await fs.promises.writeFile(finalPath, Buffer.from(pdfBuf));

    return finalPath;
  }
}
