import { createSignal, type Component, createEffect } from "solid-js";

import styles from "./App.module.css";
import {
  Relay,
  type NostrEvent,
  validateEvent,
  getEventHash,
  nip19,
} from "nostr-tools";
import {
  Form,
  Button,
  Container,
  Toast,
  ToastContainer,
  Row,
  Col,
  InputGroup,
  FormControl,
} from "solid-bootstrap";
import { getHexPubkey } from "./function";

const App: Component = () => {
  const [pubkey, setPubkey] = createSignal("");
  const [relayURL, setRelayURL] = createSignal("");
  const [show, setShow] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [event, setEvent] = createSignal<NostrEvent | null>(null);
  const [content, setContent] = createSignal<{ [key: string]: any }>({});
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal<string | boolean>("");
  const [editingKey, setEditingKey] = createSignal<string | boolean | null>(
    null
  );
  let relay: Relay;

  // setEvent({
  //   content:
  //     '{"picture":"https://i.nostr.build/zxG0.png","banner":"https://image.nostr.build/5a7827dcd2524b81b0d20851cb63899694981a794d60c4716add12ae0ea7f9ad.gif","name":"mono","display_name":"mönö₍ 掃x除 ₎もの","about":"アイコンはあわゆきさん作\\n(ひとりごと)\\n2023/02/04(土)17時位 に はじめました \\n\\nnew!【いろんなリスト見るやつ】\\nhttps://nostviewstr.vercel.app/\\n\\n【ぶくまびうあ】\\nhttps://nostr-bookmark-viewer3.vercel.app/\\n【ノートを単品で複製したいときのやつ】\\nhttps://dupstr.vercel.app/\\n\\n【もの画像】\\nhttps://tsukemonogit.github.io/nostr-monoGazo-bot/\\n\\n【初めてクエストを達成した者】https://nostx.shino3.net/note18kn29rrwehlp9dgpqlrem3ysk5tt6ucl2h2tj4e4uh53facc6g2qxwa77h","nip05":"mono@tsukemonogit.github.io","lud16":"thatthumb37@walletofsatoshi.com","displayName":"","nip05valid":true}',
  //   created_at: 1710262316,
  //   id: "e000a0059b4ba1ad1f0010b86df51f676037afd957a5185ca410428d26bc6848",
  //   kind: 0,
  //   pubkey: "84b0c46ab699ac35eb2ca286470b85e081db2087cdef63932236c397417782f5",
  //   sig: "ab61e66c7e2c33268d051a64549cb3879e3f7c71e4012b4180e8e374afa3dc23116a65e06401bcb350c4c45b0326006cc83433ff51fdaf18676b8177d1337a95",
  //   tags: [],
  // });
  // setContent(JSON.parse((event() as NostrEvent).content));

  const connectRelay = async () => {
    if (relayURL() == "" || pubkey() == "") {
      setMessage("check input pubkey or relayURL");
      setShow(true);
      return;
    }

    try {
      //relayに接続
      relay = await Relay.connect(relayURL());
      console.log(`connected to ${relay.url}`);
      const pubhex = getHexPubkey(pubkey());
      // relay.subscribeをPromiseでラップして実行
      await new Promise<void>((resolve, reject) => {
        const sub = relay.subscribe(
          [
            {
              authors: [pubhex],
              kinds: [0],
            },
          ],
          {
            onevent(e) {
              console.log("we got the event we wanted:", e);
              if (
                event() == null ||
                e.created_at > (event() as NostrEvent).created_at
              ) {
                setEvent(e);
              }
            },
            oneose() {
              sub.close();
              resolve(); // Promiseを解決して終了
            },
          }
        );
      });
      if (event() !== null) {
        setContent(JSON.parse((event() as NostrEvent).content));
      }
    } catch (error) {
      setMessage("取得できませんでした");
      setShow(true);
    }
  };

  // コンテンツの変更を検知して表示を更新
  createEffect(() => {
    console.log("Content changed:", content());
  });

  const handleAdd = () => {
    if (newKey() && newValue()) {
      const updatedContent = { ...content(), [newKey()]: newValue() };
      setContent(updatedContent);
      setNewKey("");
      setNewValue("");
    }
  };

  const handleDelete = (key: string) => {
    const updatedContent = { ...content() };
    delete updatedContent[key];
    setContent(updatedContent);
  };

  const handleEdit = (key: string | boolean) => {
    setEditingKey(key);
  };

  const handleSave = (key: string) => {
    setEditingKey(null);
  };

  const handlePublish = async () => {
    //console.log(JSON.stringify(content()));
    const { waitNostr } = await import("nip07-awaiter");
    const nostr = await waitNostr(1000);
    if (nostr === undefined) {
      alert("Install NIP-07 browser extension");
      return;
    }
    let newEvent: NostrEvent = {
      content: JSON.stringify(content()),
      kind: event()?.kind ?? 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: event()?.tags ?? [],
      pubkey: await nostr?.getPublicKey(),
      sig: "",
      id: "",
    };
    const check = validateEvent(newEvent);
    if (!check) {
      setMessage("不正なイベントです");
      return;
    }
    newEvent.id = getEventHash(newEvent);
    newEvent = await nostr?.signEvent(newEvent);
    console.log(newEvent);
    const result = await relay.publish(newEvent);
    relay.close();
    console.log(result);
    setMessage("完了しました");
    setShow(true);
  };

  const handleGetPub = async () => {
    const { waitNostr } = await import("nip07-awaiter");
    const nostr = await waitNostr(1000);
    if (nostr === undefined) {
      alert("Install NIP-07 browser extension");
      return;
    }
    const pub = await nostr.getPublicKey();
    if (pub) {
      setPubkey(nip19.npubEncode(pub));
    }
  };
  return (
    <>
      <Container fluid="md" class="my-5">
        <p>
          誰のプロフィール（kind:0）をどのリレーから取るかを決めてsubmitを押して
        </p>
        <Form>
          <InputGroup class="mb-3">
            <Button
              variant="outline-secondary"
              id="button-addon1"
              onClick={handleGetPub}
            >
              NIP-07,46 <br />
              から取得
            </Button>
            <FormControl
              aria-label="Example text with button addon"
              aria-describedby="basic-addon1"
              type="text"
              placeholder="npub..."
              value={pubkey()}
              onInput={(e) => setPubkey(e.currentTarget.value)}
            />
          </InputGroup>

          <Form.Group class="mb-3" controlId="relayURL">
            <Form.Label>relayURL</Form.Label>
            <Form.Control
              type="text"
              placeholder="wss://"
              value={relayURL()}
              onInput={(e) => setRelayURL(e.currentTarget.value)}
            />
          </Form.Group>

          <Button variant="primary" type="button" onClick={connectRelay}>
            Submit
          </Button>
        </Form>
        <hr />
        {event() !== null && (
          <>
            <h3 class="fs-3">Event</h3>
            <pre>{JSON.stringify(event(), null, 2)}</pre>
          </>
        )}
        {Object.keys(content()).length > 0 && (
          <>
            <h3 class="fs-3">profileを修正する</h3>
            <Form>
              {Object.keys(content()).map((key) => (
                <div class={styles.content}>
                  <Row>
                    <Form.Label column lg={2}>
                      {key}
                    </Form.Label>
                    <Col>
                      <InputGroup>
                        <FormControl
                          placeholder={key}
                          type="text"
                          value={content()[key]}
                          readOnly={editingKey() !== key}
                          onChange={(e) => {
                            const updatedContent = {
                              ...content(),
                              [key]:
                                e.target.value === "true"
                                  ? true
                                  : e.target.value === "false"
                                  ? false
                                  : e.target.value,
                            };
                            setContent(updatedContent);
                          }}
                        />
                        {editingKey() !== key && (
                          <>
                            <Button
                              variant="outline-primary"
                              onClick={() => handleEdit(key)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline-primary"
                              onClick={() => handleDelete(key)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {editingKey() === key && (
                          <Button
                            variant="outline-primary"
                            onClick={() => handleSave(key)}
                          >
                            Save
                          </Button>
                        )}
                      </InputGroup>
                    </Col>
                  </Row>
                </div>
              ))}

              <div>
                <input
                  type="text"
                  value={newKey()}
                  onInput={(e) => setNewKey(e.target.value)}
                  placeholder="New Key"
                />
                <input
                  type="text"
                  value={newValue().toString()}
                  onInput={(e) => {
                    // 新しい値が文字列かブール値のいずれかであることを確認
                    const value = e.target.value;
                    setNewValue(
                      value === "true"
                        ? true
                        : value === "false"
                        ? false
                        : value
                    );
                  }}
                  placeholder="New Value"
                />
                <Button variant="outline-primary" onClick={handleAdd}>
                  Add
                </Button>
              </div>
            </Form>
            <h3 class="fs-3">Relayに投げる</h3>
            <hr />
            <Button variant="warning" onClick={handlePublish}>
              Publish
            </Button>
            (NIP-07,46)
          </>
        )}
      </Container>

      <ToastContainer
        class="p-3"
        position={"bottom-center"}
        class="position-fixed"
      >
        <Toast
          onClose={() => setShow(false)}
          show={show()}
          delay={3000}
          autohide
        >
          <Toast.Body>{message()}</Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
};

export default App;
