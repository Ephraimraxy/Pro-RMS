export const templates = {
  memo: {
    title: "Internal Memo",
    data: `
      <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="/favicon.svg" style="width: 60px; height: 60px; margin-bottom: 10px;" />
          <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #6A3A22;">CSS GROUP</h1>
          <h2 style="font-size: 16px; font-weight: 700; margin-top: 5px; border-bottom: 2px solid #6A3A22; display: inline-block; padding-bottom: 5px;">INTERNAL MEMO</h2>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr>
            <td style="width: 100px; font-weight: 800; padding: 8px 0;">REF:</td>
            <td style="border-bottom: 1px solid #ccc; padding: 8px;">CSSG/ISC/MO/${new Date().getFullYear()}/001</td>
            <td style="width: 100px; font-weight: 800; padding: 8px 20px; text-align: right;">DATE:</td>
            <td style="border-bottom: 1px solid #ccc; padding: 8px; text-align: left;">${new Date().toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 8px 0;">TO:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 8px;">HHR & ADMIN</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 8px 0;">FROM:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 8px;">[Department Name]</td>
          </tr>
          <tr>
            <td style="font-weight: 800; padding: 8px 0;">SUBJECT:</td>
            <td colspan="3" style="border-bottom: 1px solid #ccc; padding: 8px; font-weight: 800; color: #6A3A22;">[ENTER SUBJECT HERE]</td>
          </tr>
        </table>
        
        <div style="line-height: 1.6; margin-top: 20px; min-height: 200px;">
          <p>Dear Sir/Madam,</p>
          <p>Following the requirements for [Department Operations], I hereby write for [Action Description]...</p>
        </div>
        
        <div style="margin-top: 50px;">
          <p style="font-weight: 800; margin-bottom: 0;">[Signatory Name]</p>
          <p style="font-size: 12px; margin-top: 2px; color: #666;">[Designation]</p>
        </div>
      </div>
    `
  },
  requisition: {
    title: "Requisition Voucher",
    data: `
      <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #333;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <img src="/favicon.svg" style="width: 50px; height: 50px;" />
            <div>
              <h1 style="font-size: 20px; font-weight: 800; margin: 0; color: #6A3A22;">CSS</h1>
              <p style="font-size: 12px; font-weight: 700; margin: 0; color: #444;">Global Integrated Farms Ltd</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #666;">
            <p>Km 10, Abuja-Keffi Expressway,</p>
            <p>Salamu Road, Gora, Nasarawa State.</p>
            <p>Email: info@cssgroup.com.ng</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <h2 style="font-size: 18px; font-weight: 800; text-decoration: underline; letter-spacing: 2px;">REQUISITION VOUCHER</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div style="flex: 1;">
            <p style="margin: 5px 0;"><strong>From:</strong> <span style="border-bottom: 1px solid #ccc; flex: 1; min-width: 200px; display: inline-block;">[Requesting Dept]</span></p>
            <p style="margin: 5px 0;"><strong>To:</strong> <span style="border-bottom: 1px solid #ccc; flex: 1; min-width: 200px; display: inline-block;">Management</span></p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 5px 0;"><strong>No.</strong> <span style="font-weight: 800; color: #6A3A22;">49630</span></p>
            <p style="margin: 5px 0;"><strong>Date:</strong> <span style="border-bottom: 1px solid #ccc; display: inline-block; width: 120px; text-align: left; padding-left: 5px;">${new Date().toLocaleDateString()}</span></p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid #000; padding: 10px; font-size: 12px;">S/N</th>
              <th style="border: 1px solid #000; padding: 10px; font-size: 12px;">Qty</th>
              <th style="border: 1px solid #000; padding: 10px; font-size: 12px;">Item Description</th>
              <th style="border: 1px solid #000; padding: 10px; font-size: 12px; width: 120px;">Amount (N)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #000; padding: 10px; height: 30px;">1</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr><td style="border: 1px solid #000; padding: 10px; height: 30px;">2</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr><td style="border: 1px solid #000; padding: 10px; height: 30px;">3</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr><td style="border: 1px solid #000; padding: 10px; height: 30px;">4</td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td><td style="border: 1px solid #000; padding: 10px;"></td></tr>
            <tr style="font-weight: 800;">
              <td colspan="3" style="border: 1px solid #000; padding: 10px; text-align: right;">TOTAL</td>
              <td style="border: 1px solid #000; padding: 10px;"></td>
            </tr>
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 40px;">
          <p><strong>Registered by:</strong> <span style="border-bottom: 1px solid #ccc; width: 150px; display: inline-block;"></span></p>
          <p><strong>Sign:</strong> <span style="border-bottom: 1px solid #ccc; width: 150px; display: inline-block;"></span></p>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 20px;">
          <p><strong>Approved by:</strong> <span style="border-bottom: 1px solid #ccc; width: 150px; display: inline-block;"></span></p>
          <p><strong>Sign:</strong> <span style="border-bottom: 1px solid #ccc; width: 150px; display: inline-block;"></span></p>
        </div>
      </div>
    `
  }
};
