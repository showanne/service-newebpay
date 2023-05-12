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
    enum: ["WebATM", "ATM轉帳", "條碼繳費",  "超商代碼繳費", "信用卡"],
    // required: true,
  },
  payment_status: {
    // 付款狀態
    type: Number,
    default: 0, // 預設 0-未付款 (0-未付款 / 1-待付款 / 2-付款完成 / 3-付款失敗 / 4-取消交易 ... )
  },
  newebpay_tokens: {
    type: [
      {
        aes_encrypt: String,
        sha_encrypt: String
      },
    ],
  }
});
const Order = mongoose.model('Order', orderSchema);

// export default Order;
module.exports = Order;