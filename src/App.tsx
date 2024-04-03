import { createSignal, type Component, createEffect } from "solid-js";

import styles from "./App.module.css";
import {
  Relay,
  type NostrEvent,
  validateEvent,
  getEventHash,
  nip19,
  getPublicKey,
  finalizeEvent,
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
  Accordion,
} from "solid-bootstrap";
import { getHexPubkey, getHexSeckey } from "./function";

const App: Component = () => {
  const [pubkey, setPubkey] = createSignal("");
  const [seckey, setSeckey] = createSignal("");
  const [relayURL, setRelayURL] = createSignal("");
  const [show, setShow] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [event, setEvent] = createSignal<NostrEvent | null>(null);
  const [content, setContent] = createSignal<Metadata>({});
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal<string | boolean>("");
  const [editingKey, setEditingKey] = createSignal<string | boolean | null>(
    null
  );
  const [newEvent, setNewEvent] = createSignal<NostrEvent | null>(null);
  const [editedContent, setEditedContent] = createSignal<Metadata | null>(null);
  let relay: Relay;

  interface Metadata {
    [key: string]: any;
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    display_name?: string;
    website?: string;
    banner?: string;
    bot?: boolean;
    lud16?: string;
  }
  //一般的なmetadataに含まれる項目
  const sampleData: Metadata = {
    name: "name",
    about: "about",
    picture: "https://example.com/picture.webp",
    nip05: "name@exapmle.com",
    display_name: "name",
    website: "https://example.com",
    banner: "https://example.com/banner.webp",
    bot: false,
    lud16: "nameswallet@wallet.com",
  };
  let pubhex: string;
  const dataReset = () => {
    setSeckey("");
    setShow(false);
    setMessage("");
    setEvent(null);
    setContent({});
    setNewKey("");
    setNewValue("");
    setEditingKey(null);
    setEditedContent(null);
  };
  const connectRelay = async () => {
    dataReset();
    if (relayURL() == "" || pubkey() == "") {
      setMessage("check input pubkey or relayURL");
      setShow(true);
      return;
    }

    try {
      pubhex = getHexPubkey(pubkey());
      //relayに接続
      relay = await Relay.connect(relayURL());
      console.log(`connected to ${relay.url}`);

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
      console.log("Content added:", content());
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
  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditedContent(null);
  };

  const handleSave = (key: string) => {
    console.log(key);
    if (
      key in sampleData &&
      editedContent() !== null &&
      typeof (editedContent() as Metadata)[key] !== typeof sampleData[key]
    ) {
      setMessage(`無効なデータです: ${key}のタイプは${typeof sampleData[key]}`);
      setShow(true);
      return;
    }
    const updatedContent = {
      ...content(),
      [key]:
        editedContent() !== null
          ? (editedContent() as Metadata)[key]
          : content()[key],
    };
    setContent(updatedContent);
    setEditingKey(null);
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

  //dore="nsec"だとnsecによるかきこみ,nullだと拡張機能で
  const handleCreateEvent = async (dore: string = "nip07") => {
    if (editingKey() !== null) {
      // 修正中の項目がある場合は注意文を表示して処理を中止
      setMessage(
        "修正中の項目があります。完了する前に修正を完了してください。"
      );
      setShow(true);
      return;
    }

    // contentの型チェックを行う
    const contentData: Metadata = content();

    // 各プロパティに対して型チェックを行う
    for (const key in contentData) {
      if (Object.prototype.hasOwnProperty.call(contentData, key)) {
        const value = contentData[key];
        // keyが存在するか、型が一致するかを確認
        if (key in sampleData && typeof value !== typeof sampleData[key]) {
          setMessage(`不正なデータが含まれています: ${key}`);
          setShow(true);
          return;
        }
      }
    }

    //console.log(JSON.stringify(content()));
    const { waitNostr } = await import("nip07-awaiter");
    const nostr = dore === "nsec" ? undefined : await waitNostr(1000);
    if (dore !== "nsec" && nostr === undefined) {
      setMessage("Install NIP-07 browser extension");
      setShow(true);

      return;
    }

    let newEvent: NostrEvent = {
      content: JSON.stringify(content()),
      kind: event()?.kind ?? 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: event()?.tags ?? [],
      pubkey:
        dore === "nsec"
          ? getPublicKey(getHexSeckey(seckey()))
          : (await nostr?.getPublicKey()) ?? "",
      sig: "",
      id: "",
    };
    pubhex = !pubhex ? getHexPubkey(pubkey()) : pubhex;
    console.log(pubhex);
    //イベントチェック
    if (pubhex !== "" && newEvent.pubkey !== pubhex) {
      setMessage("check your pubkey");
      setShow(true);
      return;
    }
    const check = validateEvent(newEvent);
    if (!check) {
      setMessage("不正なイベントです");
      return;
    }

    //
    newEvent.id = getEventHash(newEvent);
    newEvent =
      dore === "nsec"
        ? finalizeEvent(newEvent, getHexSeckey(seckey()))
        : ((await nostr?.signEvent(newEvent)) as NostrEvent);
    setNewEvent(newEvent);
  };

  const handlePublieshEvent = async () => {
    const result = await relay.publish(newEvent() as NostrEvent);
    setMessage("完了しました");
    setShow(true);
    relay.close();
    console.log(result);
  };

  return (
    <>
      <Container fluid="md" class="mt-5">
        <>
          <div class={styles.profileHeader}>
            <h3 class="fs-3">profileを修正 / 作成する</h3>{" "}
            <a
              href="https://github.com/TsukemonoGit/nos-profile-arekore"
              target="_blank"
              rel="noopener noreferrer"
              class={styles.githubCol}
            >
              Github
            </a>
          </div>
          <hr />
          <Accordion class="my-4">
            <Accordion.Item eventKey="0">
              <Accordion.Header>profileを読み込む</Accordion.Header>
              <Accordion.Body>
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

                  <Button
                    variant="primary"
                    type="button"
                    onClick={connectRelay}
                  >
                    取得
                  </Button>
                </Form>

                {event() !== null && (
                  <>
                    <hr />
                    <h3 class="fs-3">Event</h3>
                    <pre>{JSON.stringify(event(), null, 2)}</pre>
                  </>
                )}
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
          <Form>
            {Object.keys({ ...sampleData, ...content() }).map((key) => (
              <div class={styles.content}>
                <Row>
                  <Form.Label column lg={2}>
                    {key}
                  </Form.Label>
                  <Col>
                    <InputGroup>
                      <FormControl
                        as="textarea"
                        placeholder={key in sampleData ? sampleData[key] : key}
                        type="text"
                        value={
                          (editingKey() === key
                            ? editedContent()?.[key]
                            : content()[key]) || ""
                        }
                        readOnly={editingKey() !== key}
                        onChange={(e) => {
                          const updatedContent = {
                            ...editedContent(),
                            [key]:
                              e.target.value === "true"
                                ? true
                                : e.target.value === "false"
                                ? false
                                : e.target.value,
                          };
                          setEditedContent(updatedContent);
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
                        <>
                          <Button
                            variant="outline-primary"
                            onClick={() => handleSave(key)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline-secondary"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </>
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
                    value === "true" ? true : value === "false" ? false : value
                  );
                }}
                placeholder="New Value"
              />
              <Button variant="outline-primary" onClick={handleAdd}>
                Add
              </Button>
            </div>
          </Form>
          <hr />
          <h3 class="fs-3">newEvent作成</h3>
          <Button variant="warning" onClick={() => handleCreateEvent()}>
            NIP-07,46で署名
          </Button>
          <p class="text-muted small mx-1">(まだリレーには投稿されません)</p>
          <hr />
          <InputGroup class={"mb-3 " + styles.lowOpacity}>
            <FormControl
              type="text"
              placeholder="nsec..."
              value={seckey()}
              onInput={(e) => setSeckey(e.currentTarget.value)}
            />
            <Button
              variant="outline-secondary"
              onClick={() => handleCreateEvent("nsec")}
            >
              Nsecで署名
            </Button>
          </InputGroup>
        </>

        {newEvent() !== null && (
          <>
            <hr />
            <h3 class="fs-3">修正済Event</h3>
            <pre>{JSON.stringify(newEvent(), null, 2)}</pre>
            <hr />
            <h3 class="fs-3">Relayに投稿</h3>
            <Button variant="warning" onClick={() => handlePublieshEvent()}>
              投稿
            </Button>
          </>
        )}

        {/* footer */}

        <div class={"" + styles.footer}>
          <Row>
            <Col>
              関連NIP -
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/01.md#kinds"
                target="_blank"
                rel="noopener noreferrer"
                class={styles.githubCol}
              >
                01
              </a>
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/05.md"
                target="_blank"
                rel="noopener noreferrer"
                class={styles.githubCol}
              >
                05
              </a>
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/24.md"
                target="_blank"
                rel="noopener noreferrer"
                class={styles.githubCol}
              >
                24
              </a>
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/39.md"
                target="_blank"
                rel="noopener noreferrer"
                class={styles.githubCol}
              >
                39
              </a>
            </Col>
          </Row>
        </div>
      </Container>
      <ToastContainer class="p-3 position-fixed" position={"bottom-center"}>
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
