import axios from 'axios';

const ODOO_URL = import.meta.env.VITE_ODOO_URL || ''; // Can be absolute or relative proxy

const odoo = {
  /**
   * Universal JSON-RPC call for Odoo
   */
  async call(model, method, args = [], kwargs = {}) {
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        model,
        method,
        args,
        kwargs,
      },
      id: Math.floor(Math.random() * 1000 * 1000),
    };

    try {
      const response = await axios.post(`${ODOO_URL}/web/dataset/call_kw`, payload, {
        withCredentials: true,
      });
      
      if (response.data.error) {
          throw new Error(response.data.error.data.message || "Odoo Server Error");
      }
      
      return response.data.result;
    } catch (error) {
      console.error("Odoo RPC Error:", error);
      throw error;
    }
  },

  /**
   * Direct Login (Authentication)
   */
  async login(db, login, password) {
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        db,
        login,
        password,
      },
    };

    try {
      const response = await axios.post(`${ODOO_URL}/web/session/authenticate`, payload);
      if (response.data.error) {
        throw new Error(response.data.error.data.message || "Authentication Failed");
      }
      return response.data.result;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check Session
   */
  async checkSession() {
      try {
          const response = await axios.post(`${ODOO_URL}/web/session/get_session_info`, {
              jsonrpc: "2.0",
              method: "call",
              params: {}
          });
          return response.data.result;
      } catch (error) {
          return null;
      }
  }
};

export default odoo;
