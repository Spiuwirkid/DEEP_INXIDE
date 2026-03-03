
import { ScanState } from '@/lib/types';
import jsPDF from 'jspdf';

// Helper to load image
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
};

export const generatePDFReport = async (scanState: ScanState, scanId: string | null) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // -- BRAND COLORS --
    const primaryColor = [0, 48, 73]; // Dark Navy Blue
    const accentColor = [0, 168, 232]; // Cyan Blue
    const dangerColor = [220, 53, 69]; // Red
    const warningColor = [255, 193, 7]; // Yellow
    const successColor = [40, 167, 69]; // Green
    const textColor = [33, 37, 41]; // Dark Grey (Almost Black)
    const secondaryTextColor = [108, 117, 125]; // Grey

    // -- LOAD ASSETS --
    let logoImg: HTMLImageElement | null = null;
    try {
        logoImg = await loadImage('/deep_inxide_logo.png');
    } catch (e) {
        console.warn('Failed to load logo for PDF', e);
    }

    // -- HEADER FUNCTION --
    const addHeader = (y: number) => {
        // Top Bar Accent
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');

        // Logo
        if (logoImg) {
            doc.addImage(logoImg, 'PNG', margin, 15, 15, 15);
        }

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('THREAT INTELLIGENCE REPORT', pageWidth - margin, 22, { align: 'right' });

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
        doc.text('DEEP INXIDE | ADVANCED CYBER ANALYTICS', pageWidth - margin, 27, { align: 'right' });

        // Divider
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, 35, pageWidth - margin, 35);
    };

    // -- FOOTER FUNCTION --
    const addFooter = (pageNo: number) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const today = new Date().toLocaleDateString();
        doc.text(`Confidential Analysis - Generated on ${today} | Page ${pageNo}`, margin, pageHeight - 10);

        // Bottom Bar Accent
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');
    };

    // ─── PAGE 1 ───
    addHeader(0);

    let y = 50;

    // -- TARGET OVERVIEW --
    doc.setFillColor(248, 249, 250); // Light Grey Background
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 35, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TARGET IDENTIFIER', margin + 5, y + 8);

    doc.setFont('courier', 'bold'); // Monospaced for target
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(scanState.query.toUpperCase(), margin + 5, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
    doc.text(`Type: ${scanState.type.toUpperCase()}`, margin + 5, y + 28);
    doc.text(`Scan ID: ${scanId || 'N/A'}`, margin + 80, y + 28);

    y += 45;

    // -- RISK SCORE CARD --
    const riskLevel = scanState.results.compositeScore?.level || 'unknown';
    const score = scanState.results.compositeScore?.total || 0;

    // Choose Color
    let rColor = secondaryTextColor;
    if (riskLevel === 'critical') rColor = dangerColor;
    if (riskLevel === 'high') rColor = [255, 120, 0]; // Orange
    if (riskLevel === 'moderate') rColor = warningColor;
    if (riskLevel === 'low') rColor = successColor;

    // Draw Score Box
    doc.setDrawColor(rColor[0], rColor[1], rColor[2]);
    doc.setLineWidth(1);
    doc.setFillColor(rColor[0], rColor[1], rColor[2]); // Fill header of box
    doc.rect(margin, y, pageWidth - (margin * 2), 10, 'DF'); // Header

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('RISK ASSESSMENT', margin + 5, y + 7);

    // Box Body
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y + 10, pageWidth - (margin * 2), 30, 'S'); // Outline only

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(rColor[0], rColor[1], rColor[2]);
    doc.text(score.toString(), margin + 10, y + 33);

    doc.setFontSize(14);
    doc.text(`/ 100`, margin + 35, y + 33);

    doc.setFontSize(18);
    doc.text(riskLevel.toUpperCase(), pageWidth - margin - 10, y + 33, { align: 'right' });

    y += 55;

    // -- EXECUTIVE SUMMARY --
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Executive Summary', margin, y);
    doc.line(margin, y + 2, margin + 45, y + 2); // Underline
    y += 10;

    const summaryText = scanState.results.threatContext?.riskNarrative
        || "This automated report highlights potential security risks associated with the target based on aggregated threat intelligence data. Please review the technical findings below.";

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - (margin * 2));
    doc.text(splitSummary, margin, y);

    y += (splitSummary.length * 6) + 10;

    // -- KEY FINDINGS (Bullet Points) --
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Key Findings', margin, y);
    doc.line(margin, y + 2, margin + 35, y + 2); // Underline
    y += 10;

    const findings = [
        `Resolved IP: ${scanState.results.shodan?.ip || scanState.resolvedIP || 'N/A'}`,
        `Geographic Location: ${scanState.results.geo?.country || 'Unknown'} (${scanState.results.geo?.isp || 'Unknown ISP'})`,
        `Open Ports: ${scanState.results.shodan?.ports?.length || 0} discovered`,
        `Vulnerabilities: ${scanState.results.shodan?.vulns?.length || 0} CVEs identified`,
        `Malware Reputation: ${scanState.results.vt?.stats?.malicious || 0} detections (VirusTotal)`,
        `Botnet Activity: ${scanState.results.feodo?.entries?.length ? 'Yes' : 'No'}`,
        `Abuse Confidence: ${scanState.results.abuseipdb?.abuseConfidenceScore || 0}%`
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    findings.forEach(f => {
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.circle(margin + 2, y - 1, 1, 'F'); // Bullet dot
        doc.text(f, margin + 8, y);
        y += 7;
    });

    addFooter(1);

    // ─── PAGE 2: IOCs & Technical Data ───
    doc.addPage();
    addHeader(0);
    y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Technical Indicators', margin, y);
    y += 10;

    // Simple Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('TYPE', margin + 5, y + 5);
    doc.text('VALUE', margin + 40, y + 5);
    y += 10;

    // IOC List
    const iocs: { type: string, val: string }[] = [];
    if (scanState.resolvedIP) iocs.push({ type: 'IP Address', val: scanState.resolvedIP });
    if (scanState.results.dns?.Answer) {
        scanState.results.dns.Answer.slice(0, 10).forEach(ans => iocs.push({ type: 'DNS Record', val: `${ans.type === 1 ? 'A' : (ans.type === 5 ? 'CNAME' : 'REC')} ${ans.data}` }));
    }
    if (scanState.results.malwareBazaar?.data) {
        scanState.results.malwareBazaar.data.slice(0, 5).forEach(m => iocs.push({ type: 'Malware Hash', val: m.sha256_hash }));
    }
    if (scanState.results.urlhaus?.urls) {
        scanState.results.urlhaus.urls.slice(0, 5).forEach(u => iocs.push({ type: 'Malicious URL', val: u.url }));
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    iocs.slice(0, 30).forEach((ioc, i) => {
        if (y > pageHeight - 30) {
            addFooter(2);
            doc.addPage();
            addHeader(0);
            y = 50;
        }

        // Zebra striping
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, y - 4, pageWidth - (margin * 2), 6, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.text(ioc.type, margin + 5, y);
        doc.setFont('courier', 'normal');
        const splitVal = doc.splitTextToSize(ioc.val, pageWidth - margin - 45 - margin);
        doc.text(splitVal, margin + 40, y);
        y += (splitVal.length * 5) + 2;
    });

    addFooter(2);

    doc.save(`DeepInxide_Report_${scanState.query.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
