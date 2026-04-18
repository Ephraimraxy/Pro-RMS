const formatMemoRef = (deptCode, date) => {
  const d = date || new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const code = (deptCode || 'CSS').toUpperCase();
  return `CSSG/${code}/MO/${dd}/${mm}/${yyyy}/01`;
};

const formatMemoDate = (date) => {
  const d = date || new Date();
  return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}.`;
};

const buildMemoTemplate = ({ deptCode, fromLabel, toLabel, subjectLabel, headName, headTitle, date }) => {
  const ref = formatMemoRef(deptCode, date);
  const memoDate = formatMemoDate(date);
  const toText = (toLabel || 'TARGET DEPARTMENT').toUpperCase();
  const fromText = (fromLabel || '').toUpperCase();
  const subjectText = subjectLabel || '[ENTER SUBJECT HERE]';
  const senderName = headName || '';
  const senderTitle = headTitle || '';

  return `
      <div style="font-family: 'Times New Roman', 'Georgia', serif; max-width: 750px; margin: 0 auto; padding: 40px 50px; color: #1a1a1a; background: white; line-height: 1.5;">
        
        <!-- CSS Group Logo & Title -->
        <div style="text-align: center; margin-bottom: 10px;">
          <img src="/Group.png" style="width: 70px; height: auto; margin-bottom: 6px; border-radius: 8px;" />
          <div style="font-size: 18px; font-weight: 800; letter-spacing: 2px; color: #333;">CSS</div>
          <div style="font-size: 11px; color: #666; letter-spacing: 1px;">Group</div>
        </div>

        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 2px; text-transform: uppercase;">INTERNAL MEMO</h2>
        </div>
        
        <!-- Header Fields Block -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 13px;">
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 5px 0; vertical-align: top;">REF:</td>
            <td style="padding: 5px 0; border-bottom: 1px solid #999;"><span data-memo-ref>${ref}</span></td>
            <td style="width: 60px;"></td>
            <td style="width: 180px; font-weight: 800; text-align: right; padding: 5px 0; text-transform: uppercase; border-bottom: 1px solid #999;"><span data-memo-date>${memoDate}</span></td>
          </tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 13px;">
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0;">TO:</td>
            <td style="padding: 4px 0; font-weight: 700; text-transform: uppercase;"><span data-memo-to>${toText}</span></td>
          </tr>
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0;">FROM:</td>
            <td style="padding: 4px 0; text-transform: uppercase;"><span data-memo-from>${fromText}</span></td>
          </tr>
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0; vertical-align: top;">SUBJECT:</td>
            <td style="padding: 4px 0; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #333;"><span data-memo-subject>${subjectText}</span></td>
          </tr>
        </table>
        
        <hr style="border: none; border-top: 1px solid #333; margin: 8px 0 20px 0;" />
        
        <!-- Body Content -->
        <div style="font-size: 13px; line-height: 1.7; min-height: 300px; text-align: justify;">
          <p style="text-indent: 40px; margin: 0 0 15px 0;">Following the requests received from Prof. Eric Alao and Prof. I.E Ahaneku for Students Industrial Work Experience Scheme (SIWES) placement for:</p>
          
          <ol style="padding-left: 25px; margin: 0 0 20px 0;">
            <li style="margin-bottom: 8px;">Alao Danies Omotayo: A 400-level Agricultural & Bio-systems Engineering student from Landmark University.</li>
            <li style="margin-bottom: 8px;">Agomuo George Chidike: An Agricultural and Bio-resources Engineering student from Michael Okpara University of Agriculture, Umudike.</li>
          </ol>

          <p style="text-indent: 40px; margin: 0 0 15px 0;">I hereby write for allocation of one room in the staff lodge for these two students, to enable them resume by second week of April, 2026.</p>

          <p style="text-indent: 40px; margin: 0 0 15px 0;">Attached to this memo are the official letters of introduction and placement reservation requests for your consideration.</p>
        </div>
        
        <!-- Sender Signature Block -->
        <div style="margin-top: 50px; font-size: 13px;">
          <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 14px;"><span data-memo-sender-name>${senderName}</span></p>
          <p style="margin: 0; color: #444; font-size: 12px;"><span data-memo-sender-title>${senderTitle}</span></p>
        </div>
      </div>
    `;
};

export const templates = {
  memo: {
    title: "Internal Memo",
    data: buildMemoTemplate
  },
  requisition: {
    title: "Requisition Voucher",
    data: `
      <div style="font-family: 'Times New Roman', 'Georgia', serif; max-width: 750px; margin: 0 auto; padding: 30px 40px; color: #1a1a1a; background: white; border: 2px solid #1a3a6e;">
        
        <!-- Company Header -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="width: 50%; vertical-align: middle;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="/Group.png" style="width: 70px; height: auto; border-radius: 8px;" />
                <div>
                  <div style="font-size: 24px; font-weight: 900; color: #1a3a6e; letter-spacing: 1px; line-height: 1;">CSS</div>
                  <div style="font-size: 10px; font-weight: 700; color: #1a3a6e; letter-spacing: 0.5px;">Global Integrated Farms Ltd</div>
                </div>
              </div>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right; font-size: 10px; color: #333; line-height: 1.5; border-left: 2px solid #1a3a6e; padding-left: 15px;">
              <div><strong>Km 10, Abuja-Keffi Expressway,</strong></div>
              <div>Salamu Road, Gora, Nasarawa State.</div>
              <div><strong>Website:</strong> www.cssgroup.com.ng</div>
              <div><strong>Email:</strong> info@cssgroup.com.ng</div>
              <div><strong>Tel:</strong> +234 702 603 3333</div>
            </td>
          </tr>
        </table>
        
        <!-- Voucher Title -->
        <div style="text-align: center; margin: 15px 0 20px 0;">
          <h2 style="font-size: 18px; font-weight: 900; font-style: italic; text-decoration: underline; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: #1a1a1a;">REQUISITION VOUCHER</h2>
        </div>
        
        <!-- From / To / No / Date Fields -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
          <tr>
            <td style="width: 55%; padding: 4px 0;">
              <span style="font-weight: 800;">From:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 250px; min-height: 16px; margin-left: 5px;"></span>
            </td>
            <td style="width: 45%; text-align: right; padding: 4px 0;">
              <span style="font-weight: 800;">No.</span>
              <span style="font-weight: 900; font-size: 20px; font-style: italic; color: #1a1a1a; margin-left: 5px; font-family: 'Courier New', monospace;">49630</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">
              <span style="font-weight: 800;">To:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 265px; min-height: 16px; margin-left: 5px;"></span>
            </td>
            <td style="text-align: right; padding: 4px 0;">
              <span style="font-weight: 800;">Date:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px; min-height: 16px; margin-left: 5px;"></span>
            </td>
          </tr>
        </table>
        
        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #1a1a1a; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 4px; font-size: 12px; font-weight: 800; width: 40px; text-align: center;">S/N</th>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 4px; font-size: 12px; font-weight: 800; width: 60px; text-align: center;">Qty</th>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 8px; font-size: 12px; font-weight: 800; text-align: center;">Item Description</th>
              <th colspan="2" style="border: 1.5px solid #1a1a1a; padding: 2px 0 0 0; font-size: 12px; font-weight: 800; text-align: center;">
                <div style="padding: 4px; border-bottom: 1.5px solid #1a1a1a;">Amount</div>
                <div style="display: flex;">
                  <div style="flex: 1; padding: 3px; text-align: center; border-right: 1.5px solid #1a1a1a; font-size: 11px;">N</div>
                  <div style="flex: 1; padding: 3px; text-align: center; font-size: 11px;">K</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px; width: 80px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px; width: 45px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 12px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 12px 4px;"></td></tr>
            <!-- TOTAL Row -->
            <tr style="font-weight: 900;">
              <td colspan="3" style="border: 2px solid #1a1a1a; padding: 10px 8px; text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 2px;">TOTAL</td>
              <td style="border: 2px solid #1a1a1a; padding: 10px 4px;"></td>
              <td style="border: 2px solid #1a1a1a; padding: 10px 4px;"></td>
            </tr>
          </tbody>
        </table>
        
        <!-- Signatures -->
        <table style="width: 100%; font-size: 12px; margin-top: 30px;">
          <tr>
            <td style="width: 50%; padding: 8px 0;">
              <span style="font-weight: 800;">Registered by:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 150px; min-height: 14px; margin-left: 5px;"></span>
            </td>
            <td style="width: 50%; text-align: right; padding: 8px 0;">
              <span style="font-weight: 800;">Sign:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px; min-height: 14px; margin-left: 5px;"></span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-weight: 800;">Approved by:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 150px; min-height: 14px; margin-left: 5px;"></span>
            </td>
            <td style="text-align: right; padding: 8px 0;">
              <span style="font-weight: 800;">Sign:</span>
              <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px; min-height: 14px; margin-left: 5px;"></span>
            </td>
          </tr>
        </table>
      </div>
    `
  }
};
