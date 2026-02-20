import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "https://social-media-autoposting.onrender.com";

function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }
        setLoading(true);
        setError("");
        try {
            const res = await axios.post(`${API}/auth/signup`, { email, password });
            localStorage.setItem("token", res.data.access_token);
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.detail || "Signup failed. Email might already exist.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.glassCard}>
                <h1 style={styles.title}>Create Account</h1>
                <p style={styles.subtitle}>Start automating your social presence</p>

                <form onSubmit={handleSignup} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email Address</label>
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            name="password"
                            id="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ ...styles.input, position: "relative", zIndex: 10 }}
                            autoComplete="new-password"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            id="confirmPassword"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            style={{ ...styles.input, position: "relative", zIndex: 10 }}
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

                    <button type="submit" disabled={loading} style={styles.button}>
                        {loading ? "Creating Account..." : "Sign Up"}
                    </button>
                </form>

                <p style={styles.footer}>
                    Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
                </p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a1628",
        padding: "20px",
    },
    glassCard: {
        background: "rgba(26, 39, 68, 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "24px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        padding: "40px",
        width: "100%",
        maxWidth: "440px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        animation: "fadeInUp 0.6s ease-out",
    },
    title: {
        color: "#fff",
        fontSize: "32px",
        fontWeight: "700",
        marginBottom: "8px",
        textAlign: "center",
        letterSpacing: "-0.5px",
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "16px",
        marginBottom: "32px",
        textAlign: "center",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        color: "#e2e8f0",
        fontSize: "14px",
        fontWeight: "500",
        marginLeft: "4px",
    },
    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 16px",
        borderRadius: "12px",
        background: "rgba(10, 22, 40, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff",
        fontSize: "16px",
        outline: "none",
        transition: "all 0.2s ease",
    },
    button: {
        padding: "14px",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #0077b5 0%, #005885 100%)",
        color: "#fff",
        border: "none",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
        marginTop: "10px",
        boxShadow: "0 4px 15px rgba(0, 119, 181, 0.3)",
    },
    error: {
        color: "#ef4444",
        fontSize: "14px",
        textAlign: "center",
        background: "rgba(239, 68, 68, 0.1)",
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid rgba(239, 68, 68, 0.2)",
    },
    footer: {
        color: "#94a3b8",
        fontSize: "14px",
        marginTop: "24px",
        textAlign: "center",
    },
    link: {
        color: "#0077b5",
        textDecoration: "none",
        fontWeight: "600",
    },
};

export default Signup;
