// services/fingerprint.js
const HID = require('node-hid');
const EventEmitter = require('events');

class FingerprintReader extends EventEmitter {
  constructor(vendorId, productId) {
    super();
    this.vendorId = vendorId;
    this.productId = productId;
    this.device = null;
    this.isReading = false;
  }

  // Busca y abre el dispositivo HID
  connect() {
    const devices = HID.devices();
    const target = devices.find(d => d.vendorId === this.vendorId && d.productId === this.productId);
    if (!target) {
      throw new Error('Lector de huellas no encontrado. Verifica la conexión USB.');
    }
    this.device = new HID.HID(target.path);
    this.device.on('data', (data) => this.handleData(data));
    this.device.on('error', (err) => this.emit('error', err));
    console.log('Lector conectado correctamente');
    return true;
  }

  // Maneja los datos que envía el lector (depende del protocolo específico)
  handleData(data) {
    // Aquí debes procesar la trama de datos según el fabricante.
    // Para U.ARE.U 4500, consulta la documentación del SDK.
    // Ejemplo genérico: si los primeros bytes indican que es un template de huella,
    // extraemos la parte relevante y emitimos 'template'.
    if (this.isReading && data.length > 0) {
      // Suponemos que el lector envía una imagen o template en los bytes [2...]
      const template = data.slice(2).toString('base64');
      this.emit('template', template);
      this.isReading = false;
    }
  }

  // Inicia la captura de una huella (espera a que el usuario ponga el dedo)
  async captureTemplate(timeout = 10000) {
    return new Promise((resolve, reject) => {
      this.isReading = true;
      const timeoutId = setTimeout(() => {
        this.isReading = false;
        reject(new Error('Tiempo de espera agotado - no se detectó huella'));
      }, timeout);

      this.once('template', (template) => {
        clearTimeout(timeoutId);
        resolve(template);
      });
      this.once('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });

      // Envía comando al lector para que empiece a escanear
      if (this.device) {
        // Comando de inicio de captura (depende del fabricante)
        const command = Buffer.from([0x01, 0x02, 0x00]); // EJEMPLO, AJUSTAR
        this.device.write(command);
      }
    });
  }

  // Cierra la conexión
  disconnect() {
    if (this.device) {
      this.device.close();
      this.device = null;
    }
  }
}

// Los IDs de fabricante y producto para HID U.ARE.U 4500
// Puedes obtenerlos usando `HID.devices()` y buscando tu dispositivo.
// Ejemplo (debes verificar los tuyos):
const VENDOR_ID = 6268;   // ID de ejemplo, reemplazar
const PRODUCT_ID = 1317;  // ID de ejemplo, reemplazar

module.exports = new FingerprintReader(VENDOR_ID, PRODUCT_ID);