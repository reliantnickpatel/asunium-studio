export type TemplateKey = "blank" | "resume" | "invoice" | "report";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  blank: "Blank",
  resume: "Resume",
  invoice: "Invoice",
  report: "Report",
};

export const templates: Record<TemplateKey, string> = {
  blank: `<h1>Untitled document</h1><p></p>`,

  resume: `
    <h1 style="text-align:center">Alex Morgan</h1>
    <p style="text-align:center">Senior Product Designer · alex@example.com · (555) 123-4567 · San Francisco, CA</p>
    <hr>
    <h2>Summary</h2>
    <p>Product designer with 8+ years crafting intuitive, high-impact digital
    products. Proven record of leading design systems and shipping features used
    by millions.</p>
    <h2>Experience</h2>
    <h3>Lead Product Designer — Nimbus Inc.</h3>
    <p><em>2021 — Present</em></p>
    <ul>
      <li>Owned end-to-end design for the flagship analytics dashboard.</li>
      <li>Built and maintained a 120-component design system.</li>
      <li>Mentored a team of 5 designers.</li>
    </ul>
    <h3>Product Designer — Brightwave</h3>
    <p><em>2017 — 2021</em></p>
    <ul>
      <li>Redesigned onboarding, lifting activation by 34%.</li>
      <li>Ran usability studies that shaped the mobile roadmap.</li>
    </ul>
    <h2>Skills</h2>
    <p>Figma · Prototyping · Design Systems · User Research · HTML/CSS · Accessibility</p>
    <h2>Education</h2>
    <p><strong>B.A. Interaction Design</strong> — State University, 2017</p>
  `,

  invoice: `
    <h1>INVOICE</h1>
    <table>
      <tbody>
        <tr>
          <td><strong>From</strong><br>Reliant Windows Ltd.<br>12 Market Street<br>London, UK</td>
          <td><strong>Bill To</strong><br>Acme Corporation<br>500 Business Ave<br>New York, NY</td>
        </tr>
      </tbody>
    </table>
    <p><strong>Invoice #:</strong> INV-00123 &nbsp;·&nbsp; <strong>Date:</strong> 2026-07-03 &nbsp;·&nbsp; <strong>Due:</strong> 2026-07-17</p>
    <table>
      <tbody>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
        <tr><td>Window installation — living room</td><td>2</td><td>$450.00</td><td>$900.00</td></tr>
        <tr><td>Double-glazing upgrade</td><td>4</td><td>$120.00</td><td>$480.00</td></tr>
        <tr><td>On-site labour</td><td>6</td><td>$65.00</td><td>$390.00</td></tr>
        <tr><td colspan="3" style="text-align:right"><strong>Subtotal</strong></td><td>$1,770.00</td></tr>
        <tr><td colspan="3" style="text-align:right"><strong>Tax (10%)</strong></td><td>$177.00</td></tr>
        <tr><td colspan="3" style="text-align:right"><strong>Total Due</strong></td><td><strong>$1,947.00</strong></td></tr>
      </tbody>
    </table>
    <p><em>Payment due within 14 days. Thank you for your business.</em></p>
  `,

  report: `
    <h1 style="text-align:center">Quarterly Business Report</h1>
    <p style="text-align:center"><em>Q2 2026 · Prepared by the Operations Team</em></p>
    <hr>
    <h2>1. Executive Summary</h2>
    <p>Revenue grew 18% quarter-over-quarter, driven by strong performance in the
    residential segment and improved retention. This report details the key
    metrics, wins, and priorities heading into Q3.</p>
    <h2>2. Key Metrics</h2>
    <table>
      <tbody>
        <tr><th>Metric</th><th>Q1 2026</th><th>Q2 2026</th><th>Change</th></tr>
        <tr><td>Revenue</td><td>$1.20M</td><td>$1.42M</td><td>+18%</td></tr>
        <tr><td>New Customers</td><td>340</td><td>410</td><td>+21%</td></tr>
        <tr><td>Churn</td><td>4.1%</td><td>3.3%</td><td>-0.8pp</td></tr>
      </tbody>
    </table>
    <h2>3. Highlights</h2>
    <ol>
      <li>Launched the self-serve onboarding flow.</li>
      <li>Expanded into two new regional markets.</li>
      <li>Reduced average support response time to under 2 hours.</li>
    </ol>
    <h2>4. Next Quarter Priorities</h2>
    <ul>
      <li>Scale the partner referral program.</li>
      <li>Ship the mobile companion app.</li>
      <li>Improve gross margin by 3 points.</li>
    </ul>
  `,
};
