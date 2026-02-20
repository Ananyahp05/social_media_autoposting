import axios from "axios";
import { useState, useEffect, useRef } from "react";

const API = "http://localhost:8000";

function Dashboard() {
    const [topic, setTopic] = useState("");
    const [tone, setTone] = useState("professional");
    const [length, setLength] = useState("medium");
    const [generatedText, setGeneratedText] = useState("");
    const [loading, setLoading] = useState(false);
    const [linkedinConnected, setLinkedinConnected] = useState(false);
    const [twitterConnected, setTwitterConnected] = useState(false);
    const [twitterScreenName, setTwitterScreenName] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [statusType, setStatusType] = useState("success");
    const [imagePrompt, setImagePrompt] = useState("");
    const [generatingImage, setGeneratingImage] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const [imagePreview, setImagePreview] = useState(null);
    const [posting, setPosting] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [postTo, setPostTo] = useState({ linkedin: true, twitter: false });
    const fileInputRef = useRef(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("linkedin") === "success") {
            showStatus("✅ LinkedIn connected!", "success");
            window.history.replaceState({}, "", "/");
        } else if (params.get("linkedin") === "error") {
            showStatus("❌ LinkedIn: " + (params.get("message") || "Failed"), "error");
            window.history.replaceState({}, "", "/");
        }
        axios.get(`${API}/linkedin/status`)
            .then(res => setLinkedinConnected(res.data.connected))
            .catch(() => { });
        axios.get(`${API}/twitter/status`)
            .then(res => {
                setTwitterConnected(res.data.connected);
                if (res.data.screen_name) setTwitterScreenName(res.data.screen_name);
            })
            .catch(() => { });
    }, []);

    useEffect(() => { setCharCount(generatedText.length); }, [generatedText]);

    const showStatus = (msg, type = "success") => {
        setStatusMessage(msg);
        setStatusType(type);
        if (type !== "error") setTimeout(() => setStatusMessage(""), 3500);
    };

    const generateContent = async () => {
        if (!topic.trim()) { showStatus("⚠️ Enter a topic first!", "error"); return; }
        setLoading(true);
        try {
            const res = await axios.post(`${API}/content/generate`, { topic, tone, length });
            setGeneratedText(res.data.generated_text);
            showStatus("✨ Content generated!", "success");
        } catch (err) {
            showStatus("❌ " + (err.response?.data?.detail || err.message), "error");
        }
        setLoading(false);
    };

    const clearContent = () => { setGeneratedText(""); showStatus("🗑️ Cleared", "info"); };

    const loginLinkedIn = async () => {
        try { const res = await axios.get(`${API}/linkedin/login`); window.location.href = res.data.auth_url; }
        catch (err) { showStatus("❌ " + (err.response?.data?.detail || err.message), "error"); }
    };
    const disconnectLinkedIn = async () => {
        if (!window.confirm("Disconnect LinkedIn?")) return;
        try { await axios.delete(`${API}/linkedin/disconnect`); setLinkedinConnected(false); showStatus("🔓 LinkedIn disconnected", "info"); }
        catch (err) { showStatus("❌ " + (err.response?.data?.detail || err.message), "error"); }
    };
    const loginTwitter = async () => {
        try { const res = await axios.get(`${API}/twitter/login`); window.location.href = res.data.auth_url; }
        catch (err) { showStatus("❌ " + (err.response?.data?.detail || err.message), "error"); }
    };
    const disconnectTwitter = async () => {
        if (!window.confirm("Disconnect Twitter/X?")) return;
        try { await axios.delete(`${API}/twitter/disconnect`); setTwitterConnected(false); setTwitterScreenName(""); showStatus("🔓 Twitter disconnected", "info"); }
        catch (err) { showStatus("❌ " + (err.response?.data?.detail || err.message), "error"); }
    };
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { showStatus("⚠️ Select a valid image", "error"); return; }
        if (file.size > 10 * 1024 * 1024) { showStatus("⚠️ Max 10MB", "error"); return; }
        setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); showStatus("🖼️ Image attached!", "success");
    };
    const removeImage = () => {
        setSelectedImage(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };


    const handleGenerateImage = async () => {
        if (!imagePrompt.trim()) { showStatus("⚠️ Enter an image prompt first!", "error"); return; }
        setGeneratingImage(true);
        try {
            const res = await axios.post(`${API}/content/generate-image`, { prompt: imagePrompt });
            let base64Data = res.data.image_base64;
            let fileObj = null;

            if (base64Data) {
                const fetchRes = await fetch(base64Data);
                const blob = await fetchRes.blob();
                fileObj = new File([blob], "generated_image.jpg", { type: "image/jpeg" });
            } else if (res.data.image_url) {
                // Fallback: Use URL directly if backend couldn't download it
                const imageRes = await fetch(res.data.image_url);
                const blob = await imageRes.blob();
                fileObj = new File([blob], "generated_image.jpg", { type: "image/jpeg" });
                base64Data = res.data.image_url;
            }

            setSelectedImage(fileObj);
            setImagePreview(base64Data);
            showStatus("🎨 Image generated!", "success");
        } catch (err) {
            showStatus("❌ " + (err.response?.data?.detail || err.message), "error");
        }
        setGeneratingImage(false);
    };

    const postContent = async () => {

        if (!generatedText.trim()) { showStatus("⚠️ Write or generate content first!", "error"); return; }
        const targets = [];
        if (postTo.linkedin && linkedinConnected) targets.push("linkedin");
        if (postTo.twitter && twitterConnected) targets.push("twitter");
        if (targets.length === 0) { showStatus("⚠️ Select at least one connected platform!", "error"); return; }

        setPosting(true);
        const results = [];
        for (const platform of targets) {
            try {
                const formData = new FormData();
                formData.append("text", generatedText);
                if (selectedImage) formData.append("image", selectedImage);
                const res = await axios.post(`${API}/${platform}/post`, formData, { headers: { "Content-Type": "multipart/form-data" } });
                results.push(`✅ ${platform}: ${res.data.message}`);
            } catch (err) {
                results.push(`❌ ${platform}: ${err.response?.data?.detail || err.message}`);
            }
        }
        showStatus(results.join("  •  "), results.some(r => r.startsWith("❌")) ? "error" : "success");
        if (!results.some(r => r.startsWith("❌"))) removeImage();
        setPosting(false);
    };

    const copyToClipboard = () => { navigator.clipboard.writeText(generatedText); showStatus("📋 Copied!", "info"); };

    // Icons
    const LinkedInIcon = ({ size = 24, color = "#fff" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color}>
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
    const TwitterIcon = ({ size = 24, color = "#fff" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );

    const statusColors = {
        success: { bg: "rgba(46,125,50,0.15)", border: "rgba(76,175,80,0.3)", color: "#81c784" },
        error: { bg: "rgba(229,57,53,0.15)", border: "rgba(229,57,53,0.3)", color: "#ef9a9a" },
        info: { bg: "rgba(79,172,254,0.12)", border: "rgba(79,172,254,0.3)", color: "#90caf9" },
    };
    const anyConnected = linkedinConnected || twitterConnected;

    return (
        <div style={styles.page}>
            <div style={styles.bgShape1}></div>
            <div style={styles.bgShape2}></div>
            <div style={styles.bgShape3}></div>
            <div style={styles.bgShape4}></div>

            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header} className="card-animate">
                    <div style={styles.headerGlow}></div>
                    <div style={styles.headerContent}>
                        <div style={styles.headerIcon}>
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="2" width="24" height="24" rx="5" stroke="#fff" strokeWidth="2" />
                                <path d="M8 14h12M14 8v12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={styles.title}>Social Media Poster</h1>
                            <p style={styles.subtitle}>✨ AI-powered posts for LinkedIn & Twitter/X</p>
                        </div>
                    </div>
                    <svg width="160" height="90" viewBox="0 0 160 90" fill="none" style={styles.headerSvg}>
                        <circle cx="25" cy="22" r="4" fill="rgba(255,255,255,0.15)" />
                        <circle cx="70" cy="12" r="3" fill="rgba(255,255,255,0.12)" />
                        <circle cx="120" cy="28" r="5" fill="rgba(255,255,255,0.15)" />
                        <circle cx="45" cy="60" r="3" fill="rgba(255,255,255,0.1)" />
                        <circle cx="100" cy="70" r="4" fill="rgba(255,255,255,0.12)" />
                        <line x1="25" y1="22" x2="70" y2="12" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        <line x1="70" y1="12" x2="120" y2="28" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        <line x1="45" y1="60" x2="100" y2="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        <line x1="120" y1="28" x2="100" y2="70" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    </svg>
                </div>

                {/* Status */}
                {statusMessage && (
                    <div style={{ ...styles.statusBar, background: statusColors[statusType].bg, borderColor: statusColors[statusType].border, color: statusColors[statusType].color }}>
                        {statusMessage}
                        <button onClick={() => setStatusMessage("")} style={styles.statusClose}>✕</button>
                    </div>
                )}

                {/* Steps */}
                <div style={styles.stepsRow}>
                    <div style={{ ...styles.step, ...(anyConnected ? styles.stepDone : styles.stepActive) }}>
                        <span style={styles.stepNum}>{anyConnected ? "✓" : "1"}</span>
                        <span style={styles.stepLabel}>Connect</span>
                    </div>
                    <div style={styles.stepLine}></div>
                    <div style={{ ...styles.step, ...(generatedText ? styles.stepDone : (!anyConnected ? styles.stepPending : styles.stepActive)) }}>
                        <span style={styles.stepNum}>{generatedText ? "✓" : "2"}</span>
                        <span style={styles.stepLabel}>Create</span>
                    </div>
                    <div style={styles.stepLine}></div>
                    <div style={{ ...styles.step, ...((generatedText && anyConnected) ? styles.stepActive : styles.stepPending) }}>
                        <span style={styles.stepNum}>3</span>
                        <span style={styles.stepLabel}>Post</span>
                    </div>
                </div>

                {/* Platform Cards */}
                <div style={styles.platformsGrid}>
                    {/* LinkedIn */}
                    <div style={{ ...styles.platformCard, borderColor: linkedinConnected ? "rgba(0,119,181,0.3)" : "rgba(255,255,255,0.08)" }} className="card-animate">
                        <div style={styles.platformHeader}>
                            <div style={{ ...styles.platformIcon, background: "linear-gradient(135deg, #0077B5, #005f8f)" }}>
                                <LinkedInIcon size={14} color="#fff" />
                            </div>
                            <span style={styles.platformName}>LinkedIn</span>
                            <div style={{ ...styles.statusDot, background: linkedinConnected ? "#4caf50" : "#555", boxShadow: linkedinConnected ? "0 0 8px rgba(76,175,80,0.6)" : "none" }}></div>
                        </div>
                        {linkedinConnected ? (
                            <div style={styles.platformConnected}>
                                <span style={styles.connectedText}>✓ Connected</span>
                                <button onClick={disconnectLinkedIn} style={styles.btnSmallDisconnect}>Disconnect</button>
                            </div>
                        ) : (
                            <button onClick={loginLinkedIn} style={{ ...styles.btnPlatformConnect, background: "linear-gradient(135deg, #0077B5, #00a0dc)" }}>
                                Connect
                            </button>
                        )}
                    </div>

                    {/* Twitter */}
                    <div style={{ ...styles.platformCard, borderColor: twitterConnected ? "rgba(29,155,240,0.3)" : "rgba(255,255,255,0.08)" }} className="card-animate">
                        <div style={styles.platformHeader}>
                            <div style={{ ...styles.platformIcon, background: "#000" }}>
                                <TwitterIcon size={14} color="#fff" />
                            </div>
                            <span style={styles.platformName}>Twitter/X</span>
                            <div style={{ ...styles.statusDot, background: twitterConnected ? "#4caf50" : "#555", boxShadow: twitterConnected ? "0 0 8px rgba(76,175,80,0.6)" : "none" }}></div>
                        </div>
                        {twitterConnected ? (
                            <div style={styles.platformConnected}>
                                <span style={styles.connectedText}>✓ @{twitterScreenName}</span>
                                <button onClick={disconnectTwitter} style={styles.btnSmallDisconnect}>Disconnect</button>
                            </div>
                        ) : (
                            <button onClick={loginTwitter} style={{ ...styles.btnPlatformConnect, background: "linear-gradient(135deg, #1d9bf0, #0c7abf)" }}>
                                Connect
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Generation */}
                <div style={styles.card} className="card-animate">
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.cardIconCircle, background: "linear-gradient(135deg, #f093fb, #f5576c)" }}>
                            <span style={{ fontSize: 14 }}>✨</span>
                        </div>
                        <h2 style={styles.cardTitle}>Generate Content</h2>
                    </div>
                    <input type="text" placeholder="Enter your topic (e.g., AI trends, startup tips...)" value={topic} onChange={(e) => setTopic(e.target.value)} style={styles.input} onKeyDown={(e) => e.key === "Enter" && generateContent()} />
                    <div style={styles.row}>
                        <div style={styles.selectGroup}>
                            <label style={styles.label}>🎨 Tone</label>
                            <select value={tone} onChange={(e) => setTone(e.target.value)} style={styles.select}>
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="inspirational">Inspirational</option>
                                <option value="humorous">Humorous</option>
                                <option value="educational">Educational</option>
                            </select>
                        </div>
                        <div style={styles.selectGroup}>
                            <label style={styles.label}>📏 Length</label>
                            <select value={length} onChange={(e) => setLength(e.target.value)} style={styles.select}>
                                <option value="short">Short</option>
                                <option value="medium">Medium</option>
                                <option value="long">Long</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={generateContent} disabled={loading} style={{ ...styles.btnGenerate, opacity: loading ? 0.8 : 1 }}>
                        {loading ? <span style={styles.loadingContent}><span style={styles.spinner}></span>Generating...</span> : "🪄 Generate Post"}
                    </button>
                </div>

                {/* Image Upload */}
                <div style={styles.card} className="card-animate">
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.cardIconCircle, background: "linear-gradient(135deg, #4facfe, #00f2fe)" }}>
                            <span style={{ fontSize: 14 }}>🖼️</span>
                        </div>
                        <h2 style={styles.cardTitle}>Attach Image</h2>
                        <span style={styles.badge}>Optional</span>
                    </div>


                    <div style={styles.imageGenRow}>
                        <input
                            type="text"
                            placeholder="Describe an image to generate (e.g., 'A futuristic office with plants')..."
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            style={styles.inputImageGen}
                            onKeyDown={(e) => e.key === "Enter" && handleGenerateImage()}
                        />
                        <button
                            onClick={handleGenerateImage}
                            disabled={generatingImage}
                            style={{ ...styles.btnGenerateImage, opacity: generatingImage ? 0.7 : 1 }}
                        >
                            {generatingImage ? <span style={styles.spinner}></span> : "🎨 Generate"}
                        </button>
                    </div>

                    {!imagePreview ? (

                        <div style={styles.dropZone} onClick={() => fileInputRef.current?.click()}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4facfe"; e.currentTarget.style.background = "rgba(79,172,254,0.06)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(79,172,254,0.25)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                        >
                            <div style={styles.dropZoneGraphic}>
                                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                                    <rect x="4" y="8" width="44" height="36" rx="6" stroke="#4facfe" strokeWidth="2" fill="rgba(79,172,254,0.06)" />
                                    <circle cx="18" cy="22" r="4" fill="rgba(79,172,254,0.35)" />
                                    <path d="M4 34 L16 26 L26 32 L36 24 L48 34 L48 38 C48 41.3 45.3 44 42 44 L10 44 C6.7 44 4 41.3 4 38 Z" fill="rgba(0,119,181,0.18)" />
                                    <line x1="26" y1="12" x2="26" y2="20" stroke="#4facfe" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="22" y1="16" x2="30" y2="16" stroke="#4facfe" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                            <div style={styles.dropZoneText}>Click to upload an image</div>
                            <div style={styles.dropZoneHint}>JPG, PNG, GIF — Max 10MB</div>
                        </div>
                    ) : (
                        <div style={styles.previewContainer}>
                            <img src={imagePreview} alt="Preview" style={styles.previewImage} />
                            <div style={styles.previewOverlay}>
                                <button onClick={removeImage} style={styles.btnRemoveImage}>✕ Remove</button>
                            </div>
                            <div style={styles.imageFileName}>
                                📎 {selectedImage?.name}
                                <span style={styles.imageSizeBadge}>{(selectedImage?.size / 1024).toFixed(0)} KB</span>
                            </div>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
                </div>

                {/* Post Editor */}
                <div style={styles.card} className="card-animate">
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.cardIconCircle, background: "linear-gradient(135deg, #667eea, #764ba2)" }}>
                            <span style={{ fontSize: 14 }}>📝</span>
                        </div>
                        <h2 style={styles.cardTitle}>{generatedText ? "Your Post" : "Post Editor"}</h2>
                        {generatedText && (
                            <span style={{ ...styles.badge, background: charCount > 280 && postTo.twitter ? "rgba(229,57,53,0.2)" : "rgba(79,172,254,0.12)", color: charCount > 280 && postTo.twitter ? "#ef9a9a" : "#90caf9" }}>
                                {charCount} chars {postTo.twitter && charCount > 280 ? "(over Twitter limit)" : ""}
                            </span>
                        )}
                    </div>
                    <textarea value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} placeholder="Generate content above, or type your post here..." style={styles.textarea} rows={8} />

                    {generatedText && (
                        <div style={styles.contentActions}>
                            <button onClick={clearContent} style={styles.btnClear}>🗑️ Clear</button>
                            <button onClick={generateContent} disabled={loading || !topic.trim()} style={{ ...styles.btnRegenerate, opacity: (loading || !topic.trim()) ? 0.5 : 1 }}>
                                {loading ? "⏳ Regenerating..." : "🔄 Regenerate"}
                            </button>
                        </div>
                    )}

                    {/* Preview */}
                    {(generatedText || imagePreview) && (
                        <div style={styles.previewCard}>
                            <div style={styles.previewLabel}>Preview</div>
                            <div style={styles.previewInner}>
                                <div style={styles.previewHeader}>
                                    <div style={styles.previewAvatar}>
                                        <LinkedInIcon size={12} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={styles.previewName}>You</div>
                                        <div style={styles.previewTime}>Just now · 🌐</div>
                                    </div>
                                </div>
                                {generatedText && <div style={styles.previewText}>{generatedText.length > 180 ? generatedText.substring(0, 180) + "..." : generatedText}</div>}
                                {imagePreview && <img src={imagePreview} alt="Post" style={styles.previewPostImage} />}
                                <div style={styles.previewActions}>
                                    <span>👍 Like</span><span>💬 Comment</span><span>🔄 Repost</span><span>📤 Send</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Platform selector + Post */}
                    <div style={styles.postSection}>
                        <div style={styles.platformToggles}>
                            <span style={styles.toggleLabel}>Post to:</span>
                            <button onClick={() => setPostTo(p => ({ ...p, linkedin: !p.linkedin }))} disabled={!linkedinConnected}
                                style={{ ...styles.toggleBtn, ...(postTo.linkedin ? styles.toggleActiveLI : {}), borderColor: postTo.linkedin ? "#0077B5" : "rgba(255,255,255,0.12)", color: postTo.linkedin ? "#4facfe" : "#5a6d80" }}>
                                <LinkedInIcon size={14} color={postTo.linkedin ? "#0077B5" : "#5a6d80"} />
                                <span>LinkedIn</span>
                                {!linkedinConnected && <span style={styles.toggleDisabledHint}>Not connected</span>}
                            </button>
                            <button onClick={() => setPostTo(p => ({ ...p, twitter: !p.twitter }))} disabled={!twitterConnected}
                                style={{ ...styles.toggleBtn, ...(postTo.twitter ? styles.toggleActiveTW : {}), borderColor: postTo.twitter ? "#1d9bf0" : "rgba(255,255,255,0.12)", color: postTo.twitter ? "#1d9bf0" : "#5a6d80" }}>
                                <TwitterIcon size={14} color={postTo.twitter ? "#1d9bf0" : "#5a6d80"} />
                                <span>Twitter/X</span>
                                {!twitterConnected && <span style={styles.toggleDisabledHint}>Not connected</span>}
                            </button>
                        </div>
                        <div style={styles.actionRow}>
                            <button onClick={copyToClipboard} disabled={!generatedText} style={{ ...styles.btnCopy, opacity: generatedText ? 1 : 0.4 }}>📋 Copy</button>
                            <button onClick={postContent} disabled={posting || !generatedText} style={{ ...styles.btnPost, opacity: (posting || !generatedText) ? 0.5 : 1 }}>
                                {posting
                                    ? <span style={styles.loadingContent}><span style={styles.spinner}></span>Posting...</span>
                                    : `📤 Post${[postTo.linkedin && "LinkedIn", postTo.twitter && "Twitter"].filter(Boolean).join(" & ") || ""}`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <LinkedInIcon size={12} color="#3d5168" />
                    <span style={{ margin: "0 6px" }}>+</span>
                    <TwitterIcon size={12} color="#3d5168" />
                    <span style={{ marginLeft: 8 }}>Social Media Poster — Powered by AI</span>
                </div>
            </div>

            <style>{`
                @keyframes spinnerAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .card-animate { animation: fadeInUp 0.5s ease-out both; }
                .card-animate:nth-child(1) { animation-delay: 0.05s; }
                .card-animate:nth-child(2) { animation-delay: 0.1s; }
                .card-animate:nth-child(3) { animation-delay: 0.15s; }
                .card-animate:nth-child(4) { animation-delay: 0.2s; }
                .card-animate:nth-child(5) { animation-delay: 0.25s; }
                .card-animate:nth-child(6) { animation-delay: 0.3s; }
            `}</style>
        </div >
    );
}

const styles = {
    page: { minHeight: "100vh", background: "linear-gradient(160deg, #070d1a 0%, #0d1b2a 20%, #132d46 45%, #0e3b69 70%, #0a2540 100%)", position: "relative", overflow: "hidden" },
    bgShape1: { position: "fixed", top: -120, right: -120, width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,119,181,0.12) 0%, transparent 70%)", pointerEvents: "none", animation: "float 8s ease-in-out infinite" },
    bgShape2: { position: "fixed", bottom: -180, left: -120, width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,155,240,0.06) 0%, transparent 70%)", pointerEvents: "none", animation: "float 10s ease-in-out infinite 2s" },
    bgShape3: { position: "fixed", top: "35%", left: "55%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(102,126,234,0.06) 0%, transparent 70%)", pointerEvents: "none", animation: "float 12s ease-in-out infinite 4s" },
    bgShape4: { position: "fixed", top: "60%", right: "20%", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,147,251,0.05) 0%, transparent 70%)", pointerEvents: "none", animation: "float 9s ease-in-out infinite 1s" },
    container: { maxWidth: 700, margin: "0 auto", padding: "20px 20px 40px", fontFamily: "'Segoe UI', -apple-system, sans-serif", position: "relative", zIndex: 1 },

    header: { background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)", borderRadius: 18, padding: "22px 24px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)", position: "relative", overflow: "hidden" },
    headerGlow: { position: "absolute", top: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,172,254,0.08) 0%, transparent 70%)" },
    headerContent: { display: "flex", alignItems: "center", gap: 14, zIndex: 1 },
    headerIcon: { width: 50, height: 50, borderRadius: 14, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" },
    headerSvg: { position: "absolute", right: 10, top: 0, zIndex: 0 },
    title: { fontSize: 21, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.3px" },
    subtitle: { fontSize: 12, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" },

    statusBar: { padding: "10px 40px 10px 16px", borderRadius: 10, border: "1px solid", fontSize: 13, marginBottom: 14, textAlign: "center", position: "relative", animation: "fadeIn 0.3s ease-out" },
    statusClose: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, padding: 4, opacity: 0.7 },

    stepsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 16, padding: "0 20px" },
    step: { display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, transition: "all 0.3s" },
    stepActive: { background: "rgba(0,119,181,0.2)", color: "#4facfe", border: "1px solid rgba(79,172,254,0.3)" },
    stepDone: { background: "rgba(76,175,80,0.15)", color: "#81c784", border: "1px solid rgba(76,175,80,0.25)" },
    stepPending: { background: "rgba(255,255,255,0.04)", color: "#5a6d80", border: "1px solid rgba(255,255,255,0.06)" },
    stepNum: { fontSize: 11, fontWeight: 700 },
    stepLabel: { fontSize: 11 },
    stepLine: { width: 28, height: 1, background: "rgba(255,255,255,0.1)" },

    platformsGrid: { display: "flex", gap: 12, marginBottom: 14 },
    platformCard: { flex: 1, background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 16px rgba(0,0,0,0.12)", transition: "all 0.3s" },
    platformHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
    platformIcon: { width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
    platformName: { fontSize: 14, fontWeight: 600, color: "#dce6f0", flex: 1 },
    platformConnected: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    connectedText: { fontSize: 12, color: "#81c784", fontWeight: 600 },
    btnSmallDisconnect: { padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#ef9a9a", background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.2)", borderRadius: 8, cursor: "pointer" },
    btnPlatformConnect: { width: "100%", padding: "10px", fontSize: 13, fontWeight: 600, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },
    statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },

    card: { background: "rgba(255,255,255,0.05)", backdropFilter: "blur(24px)", borderRadius: 16, padding: 22, marginBottom: 14, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)" },
    cardHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
    cardIconCircle: { width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#dce6f0", margin: 0, flex: 1 },
    badge: { fontSize: 10, color: "#8899a6", background: "rgba(255,255,255,0.06)", padding: "3px 10px", borderRadius: 10, fontWeight: 500, border: "1px solid rgba(255,255,255,0.06)" },

    input: { width: "100%", padding: "12px 16px", fontSize: 14, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, outline: "none", boxSizing: "border-box", marginBottom: 14, background: "rgba(255,255,255,0.04)", color: "#e0e8f0", transition: "all 0.25s" },
    row: { display: "flex", gap: 12, marginBottom: 14 },
    selectGroup: { flex: 1 },
    label: { display: "block", fontSize: 11, color: "#7a8e9f", marginBottom: 5, fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase" },
    select: { width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, outline: "none", background: "rgba(255,255,255,0.04)", color: "#e0e8f0", cursor: "pointer" },
    textarea: { width: "100%", padding: "12px 16px", fontSize: 13, lineHeight: 1.7, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 14, fontFamily: "'Segoe UI', sans-serif", background: "rgba(255,255,255,0.04)", color: "#e0e8f0", minHeight: 120 },

    contentActions: { display: "flex", gap: 10, marginBottom: 14 },
    btnClear: { flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#ef9a9a", background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.2)", borderRadius: 10, cursor: "pointer" },
    btnRegenerate: { flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#ce93d8", background: "rgba(156,39,176,0.1)", border: "1px solid rgba(156,39,176,0.2)", borderRadius: 10, cursor: "pointer" },

    btnGenerate: { padding: "12px 24px", fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #f093fb, #f5576c)", border: "none", borderRadius: 10, width: "100%", cursor: "pointer", boxShadow: "0 4px 18px rgba(245,87,108,0.2)" },
    loadingContent: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
    spinner: { display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spinnerAnim 0.6s linear infinite" },

    imageGenRow: { display: "flex", gap: 10, marginBottom: 16 },
    inputImageGen: { flex: 1, padding: "10px 14px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, outline: "none", background: "rgba(255,255,255,0.04)", color: "#e0e8f0" },
    btnGenerateImage: { padding: "0 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #4facfe, #00f2fe)", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 100 },

    dropZone: { border: "2px dashed rgba(79,172,254,0.25)", borderRadius: 14, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)", transition: "all 0.3s" },

    dropZoneGraphic: { marginBottom: 8 },
    dropZoneText: { fontSize: 14, color: "#4facfe", fontWeight: 600 },
    dropZoneHint: { fontSize: 11, color: "#6b7c8d", marginTop: 4 },
    previewContainer: { position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" },
    previewImage: { width: "100%", maxHeight: 250, objectFit: "contain", display: "block", background: "rgba(0,0,0,0.2)" },
    previewOverlay: { position: "absolute", top: 0, right: 0, padding: 8 },
    btnRemoveImage: { padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(229,57,53,0.85)", border: "none", borderRadius: 8, cursor: "pointer" },
    imageFileName: { padding: "7px 14px", fontSize: 11, color: "#7a8e9f", background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" },
    imageSizeBadge: { fontSize: 10, color: "#5a6d80", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 8 },

    previewCard: { borderRadius: 12, marginBottom: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" },
    previewLabel: { fontSize: 10, fontWeight: 600, color: "#5a6d80", padding: "5px 14px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.04)", textTransform: "uppercase", letterSpacing: "1px" },
    previewInner: { padding: 12 },
    previewHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
    previewAvatar: { width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #0077B5, #004d73)", display: "flex", alignItems: "center", justifyContent: "center" },
    previewName: { fontSize: 13, fontWeight: 600, color: "#dce6f0" },
    previewTime: { fontSize: 10, color: "#5a6d80" },
    previewText: { fontSize: 12, color: "#9aacba", lineHeight: 1.6, marginBottom: 8, whiteSpace: "pre-wrap" },
    previewPostImage: { width: "100%", maxHeight: 170, objectFit: "cover", borderRadius: 8, marginBottom: 8 },
    previewActions: { display: "flex", justifyContent: "space-around", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#5a6d80" },

    postSection: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 },
    platformToggles: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
    toggleLabel: { fontSize: 12, color: "#7a8e9f", fontWeight: 600, marginRight: 4 },
    toggleBtn: { display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", transition: "all 0.2s", position: "relative" },
    toggleActiveLI: { background: "rgba(0,119,181,0.12)" },
    toggleActiveTW: { background: "rgba(29,155,240,0.1)" },
    toggleDisabledHint: { fontSize: 9, color: "#555", position: "absolute", bottom: -14, left: 0, whiteSpace: "nowrap" },

    actionRow: { display: "flex", gap: 10 },
    btnCopy: { padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#4facfe", background: "rgba(79,172,254,0.08)", border: "1px solid rgba(79,172,254,0.2)", borderRadius: 10, cursor: "pointer" },
    btnPost: { flex: 1, padding: "11px 24px", fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #0077B5 0%, #005f8f 100%)", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 18px rgba(0,119,181,0.2)" },

    footer: { textAlign: "center", padding: "20px 0 8px", fontSize: 11, color: "#3d5168", display: "flex", alignItems: "center", justifyContent: "center" },
};

export default Dashboard;