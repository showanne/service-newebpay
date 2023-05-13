const mongoose = require('mongoose');
const validator = require('validator');

const orderSchema = new mongoose.Schema({
  user_name: {
    type: String,
    required: [true, "個人名稱未填寫"],
  },
  user_email: {
    type: String,
    required: [true, "電子郵件未填寫"],
    // unique: true,
    // lowercase: true,
    // 自訂驗證，安裝套件 npm i validator
    // validate: {
    //   validator() {
    //     return validator.isEmail(value);
    //   },
    //   message: "信箱格式不正確",
    // },
  },
  project: {
    type: String,
    required: [true, "專案商品未填寫"],
  },
  order_note: { // 訂單備註
    type: String,
    trim: true
  },
  order_create_date: { // 訂單建立日期
    type: Date,
    default: Date.now()
  },
  order_id: {
    type: String,
    required: true,
  },
  order_status: { // 訂單狀態
    type: Number,
    default: 0 // 預設 0-未完成 (0-未完成 / 1-處理中 / 2-已完成 ... )
  },
  order_final_date: { // 訂單完成日期 <- 預設金流回傳付款完成就算訂單完成
    type: Date
  },
  payment_price: {
    // 關聯訂單總金額
    type: Number,
    min: 0,
    required: true,
  },
  payment_method: {
    // 付款方式
    type: String,
    enum: ["WEBATM", "VACC", "BARCODE",  "CVS", "CREDIT"],
    // required: true,
    // NOTE: 藍新金流以英文代號方式回應 PaymentType 支付方式
    // CREDIT=信用卡付款
    // VACC=銀行 ATM 轉帳付款
    // WEBATM=網路銀行轉帳付款
    // BARCODE=超商條碼繳費
    // CVS=超商代碼繳費
    // LINEPAY=LINE Paya 付款
    // ESUNWALLET=玉山 Wallet
    // TAIWANPAY=台灣 Pay
    // CVSCOM = 超商取貨付款
  },
  payment_status: {
    // 付款狀態
    type: Number,
    default: 0, // 預設 0-未付款 (0-未付款 / 1-待付款 / 2-付款完成 / 3-付款失敗 / 4-取消交易 ... )
    
    // TODO: 查詢指定訂單資料時，會回傳的值
    // NOTE: 藍新金流以數字回應 TradeStatus 支付狀態：
    // 0=未付款
    // 1=付款成功
    // 2=付款失敗
    // 3=取消付款
    // 6=退款
  },
  newebpay_tradeNo: {
    // 藍新金流交易序號
    type: String
  },
  newebpay_IP: {
    // 在藍新金流交易時付款人的 IP
    type: String
  },
  newebpay_escrowBank: {
    // 款項保管銀行 <- HNCB = 華南銀行
    type: String
  },
  newebpay_payBankCode: {
    // 付款人金融機構代碼
    type: String
  },
  newebpay_payerAccount5Code: {
    // 付款人金融機構帳號末五碼
    type: String
  },
  newebpay_payTime: {
    // 藍新金流定義：收到款項的支付完成時間
    type: Date
  },
  newebpay_aes_encrypt: {
    type: String
  },
  newebpay_sha_encrypt: {
    type: String
  }
});
const Order = mongoose.model('Order', orderSchema);

// export default Order;
module.exports = Order;