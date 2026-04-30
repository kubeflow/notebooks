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

// RevisionString is an opaque token that can be treated like an etag.
//   - Clients receive this value from GET requests and must include it
//     in update requests to ensure they are updating the expected version.
//   - Clients must not parse, interpret, or compare revision values
//     other than for equality, as the format is not guaranteed to be stable.
type RevisionString string
