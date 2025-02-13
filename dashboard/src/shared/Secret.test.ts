// Copyright 2020-2022 the Kubeapps contributors.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateSecretRequest,
  CreateSecretResponse,
  GetSecretNamesResponse,
  SecretType,
} from "gen/kubeappsapis/plugins/resources/v1alpha1/resources_pb";
import { KubeappsGrpcClient } from "./KubeappsGrpcClient";
import Secret from "./Secret";

describe("getSecretNames", () => {
  const expectedSecretNames = {
    "secret-one": SecretType.DOCKER_CONFIG_JSON,
    "secret-two": SecretType.OPAQUE_UNSPECIFIED,
    "secret-three": SecretType.DOCKER_CONFIG_JSON,
  };
  // Create a real client, but we'll stub out the function we're interested in.
  const client = new KubeappsGrpcClient().getResourcesServiceClientImpl();
  let mockClientGetSecretNames: jest.MockedFunction<typeof client.getSecretNames>;
  beforeEach(() => {
    mockClientGetSecretNames = jest.fn().mockImplementation(() =>
      Promise.resolve(
        new GetSecretNamesResponse({
          secretNames: expectedSecretNames,
        }),
      ),
    );

    jest.spyOn(client, "getSecretNames").mockImplementation(mockClientGetSecretNames);
    jest.spyOn(Secret, "resourcesServiceClient").mockImplementation(() => client);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the map of secret names with types", async () => {
    const result = await Secret.getDockerConfigSecretNames("default", "default");

    expect(result).toEqual(["secret-one", "secret-three"]);
  });
});

describe("createSecret", () => {
  // Create a real client, but we'll stub out the function we're interested in.
  const client = new KubeappsGrpcClient().getResourcesServiceClientImpl();
  let mockClientCreateSecret: jest.MockedFunction<typeof client.createSecret>;
  beforeEach(() => {
    mockClientCreateSecret = jest
      .fn()
      .mockImplementation(() => Promise.resolve({} as CreateSecretResponse));

    jest.spyOn(client, "createSecret").mockImplementation(mockClientCreateSecret);
    jest.spyOn(Secret, "resourcesServiceClient").mockImplementation(() => client);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a pull secret", async () => {
    const cluster = "default";
    const name = "repo-1";
    const user = "foo";
    const password = "pass";
    const email = "foo@bar.com";
    const server = "docker.io";
    const namespace = "default";

    await Secret.createPullSecret("default", name, user, password, email, server, namespace);

    expect(mockClientCreateSecret).toHaveBeenCalledWith(
      new CreateSecretRequest({
        context: {
          cluster,
          namespace,
        },
        name,
        stringData: {
          ".dockerconfigjson":
            '{"auths":{"docker.io":{"username":"foo","password":"pass","email":"foo@bar.com","auth":"Zm9vOnBhc3M="}}}',
        },
        type: SecretType.DOCKER_CONFIG_JSON,
      }),
    );
  });
});
