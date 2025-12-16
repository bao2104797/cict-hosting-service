package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.PVCDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVCResponse;
import my_spring_app.my_spring_app.dto.reponse.PVDetailResponse;
import my_spring_app.my_spring_app.dto.reponse.PVListResponse;
import my_spring_app.my_spring_app.dto.reponse.PVResponse;
import my_spring_app.my_spring_app.dto.request.PVCRequest;
import my_spring_app.my_spring_app.dto.request.PVRequest;

public interface AdminStorageService {

    PVCListResponse getPVCs();

    PVCResponse getPVC(String namespace, String name);

    PVCDetailResponse getPVCDetail(String namespace, String name);

    PVCResponse updatePVCFromYaml(String namespace, String name, String yaml);

    PVCResponse createPVCFromYaml(String yaml);

    PVCResponse createPVC(PVCRequest request);

    void deletePVC(String namespace, String name);

    PVListResponse getPVs();

    PVResponse getPV(String name);

    PVDetailResponse getPVDetail(String name);

    PVResponse updatePVFromYaml(String name, String yaml);

    PVResponse createPVFromYaml(String yaml);

    PVResponse createPV(PVRequest request);

    void deletePV(String name);
}

