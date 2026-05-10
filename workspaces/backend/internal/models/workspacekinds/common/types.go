package common

// Restrictions are used to restrict the access to a WorkspaceKind.
type Restrictions struct {
	Deny        bool         `json:"deny"`
	DenyMessage *DenyMessage `json:"denyMessage,omitempty"`
}

// DenyMessage is used to display a message when a WorkspaceKind is denied.
type DenyMessage struct {
	Text string `json:"text"`
}
