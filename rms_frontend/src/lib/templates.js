export const templates = {
  memo: {
    title: "Internal Memo",
    data: `
      <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="/favicon.svg" style="width: 70px; height: 70px; margin-bottom: 8px; border-radius: 12px;" />
          <h2 style="font-size: 15px; font-weight: 700; margin-top: 5px; border-bottom: 2px solid #333; display: inline-block; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">INTERNAL MEMO</h2>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="width: 80px; font-weight: 800; padding: 6px 0; font-size: 13px;">REF:</td>
            <td style="border-bottom: 1px solid #ccc; padding: 6px; font-size: 13px;">CSSG/ISC/MO/${new Date().getFullYear()}/001</td>
            <td style="width: 80px; font-weight: 800; padding: 6px 20px; text-align: right; font-size: 13px;">DATE:</td>
            <td style="border-bottom: 1px solid #ccc; padding: 6px; text-align: left; font-size: 13px;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 6px 0; font-size: 13px;">TO:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 6px; font-size: 13px;">HHR & ADMIN</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 6px 0; font-size: 13px;">FROM:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 6px; font-size: 13px;">ISAC</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 6px 0; font-size: 13px;">SUBJECT:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 6px; font-weight: 800; text-transform: uppercase; font-size: 13px;">[ENTER SUBJECT HERE]</td>
          </tr>
        </table>
        
        <div style="line-height: 1.6; margin-top: 15px; min-height: 250px; font-size: 13px;">
          <p>Following the requests received from...</p>
        </div>
        
        <div style="margin-top: 40px;">
          <p style="font-weight: 800; margin-bottom: 2px; font-size: 14px;">Dr. Victor Umunnakwe</p>
          <p style="font-size: 12px; margin-top: 0; color: #444;">ISAC Coordinator</p>
        </div>
      </div>
    `
  },
  requisition: {
    title: "Requisition Voucher",
    data: `
      <div style="font-family: 'Inter', sans-serif; padding: 25px; color: #333; border: 1px solid #ddd; margin: 10px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="/favicon.svg" style="width: 60px; height: 60px; border-radius: 10px;" />
            <div style="border-left: 2px solid #ccc; padding-left: 12px;">
              <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: #333; letter-spacing: -0.5px;">CSS</h1>
              <p style="font-size: 10px; font-weight: 700; margin: 0; color: #666; text-transform: uppercase;">RMS | Enterprise Workflow</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 9px; color: #444; line-height: 1.3;">
            <p><strong>Km 10, Abuja-Keffi Expressway,</strong></p>
            <p>Salamu Road, Gora, Nasarawa State.</p>
            <p>Website: www.cssgroup.com.ng</p>
            <p>Email: info@cssgroup.com.ng</p>
            <p>Tel: +234 702 603 3333</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <h2 style="font-size: 16px; font-weight: 800; text-decoration: underline; letter-spacing: 2px; text-transform: uppercase;">REQUISITION VOUCHER</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px;">
          <div style="flex: 1;">
            <p style="margin: 6px 0; display: flex; align-items: baseline;"><strong>From:</strong> <span style="border-bottom: 1px dotted #888; flex: 1; margin-left: 8px; min-height: 1.1em;"></span></p>
            <p style="margin: 6px 0; display: flex; align-items: baseline;"><strong>To:</strong> <span style="border-bottom: 1px dotted #888; flex: 1; margin-left: 8px; min-height: 1.1em;"></span></p>
          </div>
          <div style="text-align: right; min-width: 130px; margin-left: 35px;">
            <p style="margin: 6px 0;"><strong>No.</strong> <span style="font-weight: 900; color: #e11; font-size: 17px; font-family: 'Courier New', monospace;">49630</span></p>
            <p style="margin: 6px 0;"><strong>Date:</strong> <span style="border-bottom: 1px dotted #888; display: inline-block; width: 100px;"></span></p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f1f1;">
              <th style="border: 1px solid #000; padding: 6px; font-size: 11px; width: 35px;">S/N</th>
              <th style="border: 1px solid #000; padding: 6px; font-size: 11px; width: 70px;">Qty</th>
              <th style="border: 1px solid #000; padding: 6px; font-size: 11px;">Item Description</th>
              <th style="border: 1px solid #000; padding: 6px; font-size: 11px; width: 130px;">Amount (N)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 12px;">1</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr><td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 12px;">2</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr><td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 12px;">3</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr style="font-weight: 800; background: #fafafa;">
              <td colspan="3" style="border: 1px solid #000; padding: 10px; text-align: right; text-transform: uppercase; font-size: 11px;">TOTAL</td>
              <td style="border: 1px solid #000; padding: 10px;"></td>
            </tr>
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 25px;">
          <div style="width: 45%;">
            <p style="margin-bottom: 20px;"><strong>Registered by:</strong> <span style="border-bottom: 1px dotted #888; display: inline-block; width: 130px;"></span></p>
            <p><strong>Approved by:</strong> <span style="border-bottom: 1px dotted #888; display: inline-block; width: 130px;"></span></p>
          </div>
          <div style="width: 45%; text-align: right;">
            <p style="margin-bottom: 20px;"><strong>Sign:</strong> <span style="border-bottom: 1px dotted #888; display: inline-block; width: 100px;"></span></p>
            <p><strong>Sign:</strong> <span style="border-bottom: 1px dotted #888; display: inline-block; width: 100px;"></span></p>
          </div>
        </div>
      </div>
    `
  }
};
