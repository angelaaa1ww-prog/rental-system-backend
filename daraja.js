const mpesa = require("./utils/mpesa");

module.exports = {
  ...mpesa,
  stkPush: (phone, amount) => mpesa.stkPush({ phone, amount }),
};
