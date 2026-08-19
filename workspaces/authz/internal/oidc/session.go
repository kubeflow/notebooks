/*
Copyright 2026.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package oidc

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

// SessionKeyLength is the required length of the key used to encrypt session
// cookies.
const SessionKeyLength = 32

// session is the state persisted in the browser cookie between requests.
type session struct {
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	// Expiry is the ID token expiry as a Unix timestamp, used to decide whether
	// a refresh is needed before verifying the token.
	Expiry int64 `json:"expiry"`
}

// sessionCodec seals and opens session cookies with AES-GCM, so that the
// tokens are neither readable nor forgeable by the client.
type sessionCodec struct {
	aead cipher.AEAD
}

func newSessionCodec(key []byte) (*sessionCodec, error) {
	if len(key) != SessionKeyLength {
		return nil, fmt.Errorf("session key must be %d bytes, got %d", SessionKeyLength, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating AEAD: %w", err)
	}
	return &sessionCodec{aead: aead}, nil
}

// seal encrypts any JSON-serialisable value into a cookie-safe string.
func (c *sessionCodec) seal(value any) (string, error) {
	plaintext, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("marshalling session: %w", err)
	}

	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generating nonce: %w", err)
	}

	sealed := c.aead.Seal(nonce, nonce, plaintext, nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

// open decrypts a value produced by seal into out.
func (c *sessionCodec) open(value string, out any) error {
	sealed, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return fmt.Errorf("decoding session: %w", err)
	}
	if len(sealed) < c.aead.NonceSize() {
		return fmt.Errorf("session too short")
	}

	nonce, ciphertext := sealed[:c.aead.NonceSize()], sealed[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return fmt.Errorf("opening session: %w", err)
	}

	if err := json.Unmarshal(plaintext, out); err != nil {
		return fmt.Errorf("unmarshalling session: %w", err)
	}
	return nil
}
