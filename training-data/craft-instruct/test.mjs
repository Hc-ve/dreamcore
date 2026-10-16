import dashscope from 'dashscope';

dashscope.apiKey = process.env.DASHSCOPE_API_KEY;

async function test() {
  const res = await dashscope.Generation.call({
    model: "qwen-turbo",
    messages: [{role:"user", content:"你好"}],
  });
  console.log(res.output.text);
}
test().catch(e=>console.error("报错：",e));
