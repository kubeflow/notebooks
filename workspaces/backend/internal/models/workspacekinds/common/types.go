/*
Copyright 2024.

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
