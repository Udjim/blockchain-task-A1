pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/IRoleContract.sol";
import "./TransferHelper.sol";
import "hardhat/console.sol";

contract InvestPool is Ownable {
    // =================================
    // Storage
    // =================================

    uint256 public constant MAX_FEE = 1000;
    IRoleContract public immutable rolesContract;
    address public immutable LPtoken;
    address public immutable paymentToken;
    uint8 private immutable paymentTokenDecimals;
    address public immutable fundrisingWallet;

    uint256 public baseFee;
    uint256 public price;

    uint256 public maxAmountToSell;
    uint256 public alreadySold;
    uint256 public totalPaymentTokenSpended;
    uint256 public totalLPDeposited;

    mapping(address => uint256) public alreadyBought;

    struct RoleSettings {
        uint256 startTime;
        uint256 deadline;
        uint256 roleFee;
        uint256 maxAmountToSellForRole;
        uint256 soldAmountForThisRole;
        uint256 totalAmountOfPaymentTokenSpended;
    }

    mapping(uint256 => RoleSettings) public roleSettings;

    struct RoleSettingsSetter {
        uint256 roleNumber;
        uint256 startTime;
        uint256 deadline;
        uint256 roleFee;
        uint256 maxAmountToSellForRole;
    }

    address public manager;

    // =================================
    // Modifier
    // =================================

    modifier onlyManager() {
        require(msg.sender == manager || msg.sender == owner(), "OM");
        _;
    }

    // =================================
    // Events
    // =================================

    event RoleSettingsChanged(
        uint256 roleNumber,
        uint256 startTime,
        uint256 deadline,
        uint256 roleFee,
        uint256 maxAmountToSellForRole
    );
    event Purchase(address user, uint256 amount);

    // =================================
    // Constructor
    // =================================

    constructor(
        address _LPtoken,
        address _rolesContract,
        address _paymentToken,
        address _fundrisingWallet,
        uint256 _baseFee,
        uint256 _price,
        uint256 _maxAmountToSell,
        address _manager,
        RoleSettingsSetter[] memory _roleSettings
    ) {
        require(_baseFee <= MAX_FEE, "FTH");

        LPtoken = _LPtoken;
        rolesContract = IRoleContract(_rolesContract);
        paymentToken = _paymentToken;
        paymentTokenDecimals = IERC20Metadata(_paymentToken).decimals();
        fundrisingWallet = _fundrisingWallet;

        baseFee = _baseFee;
        price = _price;
        maxAmountToSell = _maxAmountToSell;
        manager = _manager;

        setRoleSettings(_roleSettings);
    }

    // =================================
    // Functions
    // =================================

    function buy(uint256 paymentTokenAmount) external {
        uint256 userRoleNum = rolesContract.getRoleNumber(msg.sender);
        (uint256 minAmountForRole, uint256 maxAmountForRole) = rolesContract
            .getAmounts(msg.sender);
        RoleSettings storage userRole = roleSettings[userRoleNum];

        uint256 paymentTokenAmountWithoutFee = (paymentTokenAmount *
            (1000 - (userRole.roleFee == 0 ? baseFee : userRole.roleFee))) /
            1000;
        uint8 lpTokenDecimals = IERC20Metadata(LPtoken).decimals();
        uint256 lpTokenAmount = (paymentTokenAmountWithoutFee *
            10 ** lpTokenDecimals) / (price * 10 ** (paymentTokenDecimals - 2));

        require(
            paymentTokenAmountWithoutFee + alreadyBought[msg.sender] <=
                maxAmountForRole,
            "KP"
        );
        require(
            paymentTokenAmountWithoutFee + alreadyBought[msg.sender] >=
                minAmountForRole,
            "IA"
        );
        require(
            block.timestamp >= userRole.startTime &&
                block.timestamp <= userRole.deadline,
            "TE"
        );
        require(
            userRole.soldAmountForThisRole + lpTokenAmount <=
                userRole.maxAmountToSellForRole,
            "RR"
        );
        require(alreadySold + lpTokenAmount <= maxAmountToSell, "LT");

        TransferHelper.safeTransferFrom(
            paymentToken,
            msg.sender,
            fundrisingWallet,
            paymentTokenAmount
        );

        alreadyBought[msg.sender] += paymentTokenAmountWithoutFee;
        userRole.soldAmountForThisRole += lpTokenAmount;
        alreadySold += lpTokenAmount;
        totalPaymentTokenSpended += paymentTokenAmount;
        userRole.totalAmountOfPaymentTokenSpended += paymentTokenAmount;

        TransferHelper.safeTransfer(LPtoken, msg.sender, lpTokenAmount);

        emit Purchase(msg.sender, lpTokenAmount);
    }

    function buyLP(uint256 lpTokenAmount) external {
        uint256 userRoleNum = rolesContract.getRoleNumber(msg.sender);
        (uint256 minAmountForRole, uint256 maxAmountForRole) = rolesContract
            .getAmounts(msg.sender);
        RoleSettings storage userRole = roleSettings[userRoleNum];

        uint8 lpTokenDecimals = IERC20Metadata(LPtoken).decimals();
        uint256 paymentTokenAmountWithoutFee = (lpTokenAmount *
            price *
            10 ** (paymentTokenDecimals)) / 10 ** lpTokenDecimals;

        uint256 paymentTokenAmount = (paymentTokenAmountWithoutFee *
            (1000 + (userRole.roleFee == 0 ? baseFee : userRole.roleFee))) /
            1000;
        require(
            block.timestamp >= userRole.startTime &&
                block.timestamp <= userRole.deadline,
            "TE"
        );
        require(
            paymentTokenAmountWithoutFee + alreadyBought[msg.sender] <=
                maxAmountForRole,
            "KP"
        );
        require(
            paymentTokenAmountWithoutFee + alreadyBought[msg.sender] >=
                minAmountForRole,
            "IA"
        );
        require(
            userRole.soldAmountForThisRole + lpTokenAmount <=
                userRole.maxAmountToSellForRole,
            "RR"
        );
        require(alreadySold + lpTokenAmount <= maxAmountToSell, "LT");

        TransferHelper.safeTransferFrom(
            paymentToken,
            msg.sender,
            fundrisingWallet,
            paymentTokenAmount
        );

        alreadyBought[msg.sender] += paymentTokenAmountWithoutFee;
        userRole.soldAmountForThisRole += lpTokenAmount;
        alreadySold += lpTokenAmount;
        totalPaymentTokenSpended += paymentTokenAmount;
        userRole.totalAmountOfPaymentTokenSpended += paymentTokenAmount;

        TransferHelper.safeTransfer(LPtoken, msg.sender, lpTokenAmount);

        emit Purchase(msg.sender, lpTokenAmount);
    }

    // =================================
    // Admin functions
    // =================================

    function setMaxAmountToSell(uint256 _maxAmountToSell) external onlyManager {
        maxAmountToSell = _maxAmountToSell;
    }

    function setRoleSettings(
        RoleSettingsSetter[] memory _roleSettings
    ) public onlyManager {
        for (uint256 i = 0; i < _roleSettings.length; i++) {
            require(_roleSettings[i].roleFee <= MAX_FEE, "FTH");

            roleSettings[_roleSettings[i].roleNumber].startTime = _roleSettings[
                i
            ].startTime;
            roleSettings[_roleSettings[i].roleNumber].deadline = _roleSettings[
                i
            ].deadline;
            roleSettings[_roleSettings[i].roleNumber].roleFee = _roleSettings[i]
                .roleFee;
            roleSettings[_roleSettings[i].roleNumber]
                .maxAmountToSellForRole = _roleSettings[i]
                .maxAmountToSellForRole;
            emit RoleSettingsChanged(
                _roleSettings[i].roleNumber,
                _roleSettings[i].startTime,
                _roleSettings[i].deadline,
                _roleSettings[i].roleFee,
                _roleSettings[i].maxAmountToSellForRole
            );
        }
    }

    function setRoleSetting(
        RoleSettingsSetter memory _rolesSetting
    ) external onlyManager {
        roleSettings[_rolesSetting.roleNumber].startTime = _rolesSetting
            .startTime;
        roleSettings[_rolesSetting.roleNumber].deadline = _rolesSetting
            .deadline;
        roleSettings[_rolesSetting.roleNumber].roleFee = _rolesSetting.roleFee;
        roleSettings[_rolesSetting.roleNumber]
            .maxAmountToSellForRole = _rolesSetting.maxAmountToSellForRole;
        emit RoleSettingsChanged(
            _rolesSetting.roleNumber,
            _rolesSetting.startTime,
            _rolesSetting.deadline,
            _rolesSetting.roleFee,
            _rolesSetting.maxAmountToSellForRole
        );
    }

    function setPrice(uint256 _price) external onlyManager {
        price = _price;
    }

    function setBaseFee(uint256 _baseFee) public onlyManager {
        require(_baseFee <= MAX_FEE, "FTH");
        baseFee = _baseFee;
    }

    function updateSettings(
        RoleSettingsSetter[] memory _roleSettings,
        uint256 _price,
        uint256 _baseFee,
        uint256 _maxAmountToSell
    ) external onlyManager {
        setRoleSettings(_roleSettings);
        price = _price;
        setBaseFee(_baseFee);
        maxAmountToSell = _maxAmountToSell;
    }

    function depositLPtoken(uint256 _amount) external onlyManager {
        TransferHelper.safeTransferFrom(
            LPtoken,
            msg.sender,
            address(this),
            _amount
        );
        totalLPDeposited += _amount;
    }

    function withdrawLPtoken(
        address _to,
        uint256 _amount
    ) external onlyManager {
        TransferHelper.safeTransfer(LPtoken, _to, _amount);
        if (totalLPDeposited >= _amount) {
            totalLPDeposited -= _amount;
        } else {
            totalLPDeposited = 0;
        }
    }

    function setManager(address _manager) external onlyOwner {
        manager = _manager;
    }
}
