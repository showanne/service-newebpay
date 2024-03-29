const crypto = require('crypto');
const Order = require('../model/orderModels');

// const orders = {} // 暫存訂單資料
const RespondType = 'JSON'

// createOrder 建立訂單 - POST /createOrder
async function createOrder (req, res, next) {
  const orderData = req.body // 前端傳過來的訂單資料
  const timeStamp = Math.round(new Date().getTime() / 1000) // 藍新金流有限制時間戳長度 10 位數
  console.log(orderData, timeStamp);

  try {
    const newOrder = await Order.create({
      user_name: orderData.name,
      user_email: orderData.email,
      project: orderData.itemDesc,
      order_id: timeStamp, // 使用時間戳當作商店訂單編號
      payment_price: orderData.amt,
      // payment_method: 'WebATM'
    })
    console.log(newOrder);
    res.status(200).send({
      success: true,
      message: '建立訂單成功',
      newOrder
    })
  } catch (error) {
    console.error(error.message);
    // if (error instanceof MongoServerError) {} // 關鍵字判斷錯誤物件是否為 MongoServerError
    res.status(400).send({
      success: true,
      message: error.message
    })
  }
  
  // orders[timeStamp] = {
  //   ...orderData, // 將前端的資料取出來
  //   timeStamp,
  //   merchantOrderNo: timeStamp
  // }
  // console.log('/createOrder', orders);
  // res.json(orders[timeStamp]); // 將整筆訂單資料傳給前端
}

// getOrder 確認訂單 - GET /getOrder/:id
async function getOrder (req, res) {
  const { id } = req.params // 取得附在網址上的訂單編號
  const order = await Order.find({ order_id: id })
  // const paramsString = genDataChain(order) // 組成藍新金流所需字串
  // console.log(id, paramsString);
  // console.log('/getOrder/:id', order);
  
  const aesEncrypt = create_mpg_aes_encrypt(order) // 交易資料
  console.log('aesEncrypt：', aesEncrypt);
  
  const shaEncrypt = create_mpg_sha_encrypt(aesEncrypt) // 交易驗證用
  console.log('shaEncrypt：', shaEncrypt);

  const checkOrder = await Order.findOneAndUpdate(
    { order_id: id },
    {
      $set: {
        newebpay_aes_encrypt: aesEncrypt,
        newebpay_sha_encrypt: shaEncrypt,
      },
    },
    { new: true }
  );

  console.log('order: ', checkOrder);

  try {
    console.log(order);
    res.status(200).send({
      success: true,
      message: '取得訂單資料',
      checkOrder
    })
  } catch (error) {
    res.status(400).send({
      success: true,
      message: error.message
    })
  }
  
  // res.json({
  //   order, // 將整筆訂單資料傳給前端
  //   aesEncrypt,
  //   shaEncrypt
  // });
}

// mpg_gateway_return_url 藍新金流通知交易資訊 - 藍新以POST mpg_return
async function mpg_return (req, res) {
  console.count('/mpg_gateway_return_url');
  try {

    const data = req.body;
    // console.log('/mpg_gateway_return_url', data);

    // 將回傳的資料解密
    const info = create_mpg_aes_decrypt(data.TradeInfo)
    // console.log('/mpg_gateway_return_url', info.Result);

    // 將解密後的資料轉換為字串形式
    const queryString = new URLSearchParams(info.Result).toString();

    const orderId = info.Result.MerchantOrderNo
    const order = await Order.findOne({ order_id: orderId })

    // 檢查該筆訂單存不存在
    if (!order) {
      return res.status(404).end();
    }

    // const redirectUrl = 'return/?' + queryString
    const redirectUrl = 'return/' + orderId

    // 將請求傳給前台
    res.redirect(redirectUrl)

    // res.render('return', {
    //   title: info.Message,
    //   formData: updateOrder
    // });

  } catch (error) {
    console.log('error', error.message);

    res.status(400).send({
      success: false,
      message: error.message
    })
  }
  
  
  // res.render('return', {
  //   title: info.Message,
  //   formData: order
  // });
  // res.json(orders[info.Result.MerchantOrderNo]); // 將整筆訂單資料傳給前端
}

// mpg_gateway_notify_url 藍新金流通知付款完成 - POST mpg_notify
async function mpg_notify (req, res) {
  console.count('/mpg_gateway_notify_url');
  try {
    // console.log('/mpg_gateway_notify_url - req', req);

    const data = req.body;
    // console.log('/mpg_gateway_notify_url', data);

    // 將回傳的資料解密
    const info = create_mpg_aes_decrypt(data.TradeInfo)
    console.log('/mpg_gateway_notify_url', info.Result);

    const order_id = info.Result.MerchantOrderNo

    // 回傳的資料 /mpg_gateway_notify_url {
    //   MerchantID: 'MS148719690',
    //   Amt: 100,
    //   TradeNo: '23051323503404758', / TradeNo 藍新金流交易序號
    //   MerchantOrderNo: '1683993023',
    //   RespondType: 'JSON',
    //   IP: '123.193.181.242', / THINK: 可以再看看需不需要存資料庫
    //   EscrowBank: 'HNCB', / EscrowBank 款項保管銀行 <- HNCB = 華南銀行 / THINK: 可以再看看需不需要存資料庫
    //   PaymentType: 'WEBATM', / PaymentType 支付方式
    //   PayTime: '2023-05-1323:50:34', / PayTime 支付完成時間 
    //   PayerAccount5Code: '12345', / PayerAccount5Code 付款人金融機構帳號末五碼
    //   PayBankCode: '809' / PayBankCode 付款人金融機構代碼
    // }

    // 檢查該筆訂單存不存在
    // console.log(info, info.Result.MerchantOrderNo);
    const order = await Order.findOne({ order_id: order_id })
    if (!order) {
      return res.status(404).end();
    }
    // console.log('order', order);

    // 取出訂單資料並將藍新金流回傳的交易結果更新
    // console.log(orders[info.Result.MerchantOrderNo]);
    const updateOrder = await Order.findOneAndUpdate(
      { order_id: order_id },
      {
        $set: {
          order_status: 2, // 更新訂單狀態為 2-已完成
          order_final_date: new Date(),
          payment_method: info.Result.PaymentType,
          payment_status: 2, // 更新付款狀態為 2-付款完成 / THINK: 貌似有收到 notify 就一定算成功交易？
          newebpay_tradeNo: info.Result.TradeNo,
          newebpay_escrowBank: info.Result.PayBankCode,
          newebpay_payBankCode: info.Result.PayBankCode,
          newebpay_payerAccount5Code: info.Result.PayerAccount5Code,
          newebpay_payTime: info.Result.PayTime // 詭異的日期格式 "2023-05-1402:20:43"
        },
      },
      { new: true }
    );
  
    console.log('Order Notify', updateOrder);
    
    res.status(200).end();
    
    // ChatGPT: 因為 notify_url 是藍新金流向你的伺服器發送的 HTTP POST 請求，而你的伺服器只需要處理此請求，不需要回應任何 HTTP 狀態碼。藍新金流不會因為接收到的回應碼是什麼而影響交易流程，所以不需要回應 200。
    // res.sendStatus(200);

    // res.status(200).send({
    //   success: true,
    //   message: '更新訂單狀態',
    //   updateOrder
    // })
  } catch (error) {
    console.log('error', error.message);
    
    res.status(400).send({
      success: false,
      message: error.message
    })
  }

  res.end();
}

// getReturn 呈現交易資料 - GET /return/
async function getReturn (req, res) {
  const { id } = req.params // 取得附在網址上的訂單編號
  const order = await Order.findOne({ order_id: id })
  console.log('order: ', order);
  
  try {
    res.render('return', {
      title: '交易結果',
      formData: order
    });
  } catch (error) {
    res.status(400).send({
      success: true,
      message: error.message
    })
  }
}

// TODO: 查詢指定訂單資料 - 用訂單編號來發動單筆查詢 藍新金流API
async function getOrderById (req, res) {

}

// 組成藍新金流所需字串 - 特別注意轉換字串時，ItemDesc、Email 會出現問題，要使用 encode 來轉換成藍新金流要的格式
function genDataChain(order) {
  // console.log('genDataChain(order):', order[0]);
  const orderData = `MerchantID=${process.env.Newebpay_MerchantID}&RespondType=${RespondType}&TimeStamp=${order[0].order_id}&Version=${process.env.Newebpay_Version}&MerchantOrderNo=${order[0].order_id}&Amt=${order[0].payment_price}&ItemDesc=${encodeURIComponent(order[0].project)}&Email=${encodeURIComponent(order[0].user_email)}`
  // console.log('genDataChain:', orderData);
  // TODO: 有空再實作 "CustomerURL 商店取號網址"，要將此資訊加入 TradeInfo，一起傳給藍新
  return orderData;
}

// 使用 aes 加密
// $edata1=bin2hex(openssl_encrypt($data1, "AES-256-CBC", $key, OPENSSL_RAW_DATA, $iv));
function create_mpg_aes_encrypt(TradeInfo) {
  const encrypt = crypto.createCipheriv('aes256', process.env.Newebpay_HashKey, process.env.Newebpay_HashIV); // 製作加密資料
  const enc = encrypt.update(genDataChain(TradeInfo), 'utf8', 'hex'); // 將訂單內容加密
  return enc + encrypt.final('hex');
}

// sha256 加密
// $hashs="HashKey=".$key."&".$edata1."&HashIV=".$iv;
function create_mpg_sha_encrypt(aesEncrypt) {
  const sha = crypto.createHash('sha256');
  const plainText = `HashKey=${process.env.Newebpay_HashKey}&${aesEncrypt}&HashIV=${process.env.Newebpay_HashIV}`;

  return sha.update(plainText).digest('hex').toUpperCase();
}

// 將 aes 解密
function create_mpg_aes_decrypt(TradeInfo) {
  const decrypt = crypto.createDecipheriv('aes256', process.env.Newebpay_HashKey, process.env.Newebpay_HashIV);
  decrypt.setAutoPadding(false);
  const text = decrypt.update(TradeInfo, 'hex', 'utf8');
  const plainText = text + decrypt.final('utf8');
  const result = plainText.replace(/[\x00-\x20]+/g, '');
  return JSON.parse(result);
}

module.exports = {
  createOrder,
  getOrder,
  mpg_return,
  getReturn,
  mpg_notify
};